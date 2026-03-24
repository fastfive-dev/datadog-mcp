import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { DatadogClient } from './lib/datadog-client';
import { registerMetricsTools } from './tools/metrics';
import { registerLogsTools } from './tools/logs';

const ddClient = new DatadogClient(
  process.env.DD_API_KEY || '',
  process.env.DD_APP_KEY || '',
  process.env.DD_SITE || 'datadoghq.com',
);

function createServer(): McpServer {
  const server = new McpServer({
    name: 'datadog-mcp',
    version: '1.0.0',
  });
  registerMetricsTools(server, ddClient);
  registerLogsTools(server, ddClient);
  return server;
}

function apiGatewayToReqRes(event: APIGatewayProxyEvent): {
  req: IncomingMessage;
  res: ServerResponse;
  getResponse: () => APIGatewayProxyResult;
} {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString()
    : event.body || '';

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = event.httpMethod;
  req.url = event.path;
  const normalizedHeaders: Record<string, string> = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v as string]),
  );
  // MCP spec requires Accept header listing both application/json and text/event-stream
  if (!normalizedHeaders['accept']) {
    normalizedHeaders['accept'] = 'application/json, text/event-stream';
  }
  // Host header is required by the underlying HTTP adapter to construct request URL
  if (!normalizedHeaders['host']) {
    normalizedHeaders['host'] = 'localhost';
  }
  req.headers = normalizedHeaders;
  // Hono reads rawHeaders (flat key/value pairs) rather than the headers object
  req.rawHeaders = Object.entries(normalizedHeaders).flat();

  // Push body into readable stream
  req.push(body);
  req.push(null);

  // Attach parsed body for transport.handleRequest
  if (body) {
    try {
      (req as any).body = JSON.parse(body);
    } catch {
      (req as any).body = undefined;
      (req as any).parseError = true;
    }
  }

  let responseBody = '';
  let responseStatus = 200;
  const responseHeaders: Record<string, string> = {};

  const res = new ServerResponse(req);
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode: number, ...args: any[]) {
    responseStatus = statusCode;
    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      Object.assign(responseHeaders, args[0]);
    }
    return originalWriteHead(statusCode, ...args);
  } as any;

  const chunkToString = (chunk: any): string => {
    if (typeof chunk === 'string') return chunk;
    if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
    if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
    return String(chunk);
  };

  const originalWrite = res.write.bind(res);
  res.write = function (chunk: any, ...args: any[]) {
    responseBody += chunkToString(chunk);
    return originalWrite(chunk, ...args);
  } as any;

  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, ...args: any[]) {
    if (chunk) {
      responseBody += chunkToString(chunk);
    }
    return originalEnd(chunk, ...args);
  } as any;

  const getResponse = (): APIGatewayProxyResult => ({
    statusCode: responseStatus,
    headers: {
      'Content-Type': 'application/json',
      ...responseHeaders,
    },
    body: responseBody,
  });

  return { req, res, getResponse };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true, // Required for Lambda — SSE streaming not supported
    });

    await server.connect(transport);

    const { req, res, getResponse } = apiGatewayToReqRes(event);

    if ((req as any).parseError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: invalid JSON' },
          id: null,
        }),
      };
    }

    await transport.handleRequest(req, res, (req as any).body);

    // handleRequest awaits until res.end() is called, so response body is captured at this point
    const response = getResponse();
    await transport.close();
    await server.close();
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message },
        id: null,
      }),
    };
  }
};
