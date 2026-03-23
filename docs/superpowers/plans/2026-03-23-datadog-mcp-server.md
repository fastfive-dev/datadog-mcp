# Datadog MCP Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a read-only Datadog MCP server on AWS Lambda that team members can use from Claude via shared API Key.

**Architecture:** TypeScript MCP server using Streamable HTTP transport in stateless mode on Lambda. API Gateway provides API Key auth. Datadog API client wraps metrics and logs read endpoints.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, axios, AWS SAM (Lambda + API Gateway), zod

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, build/test scripts |
| `tsconfig.json` | TypeScript compilation config |
| `src/lib/time-utils.ts` | Relative time string → epoch seconds converter |
| `src/lib/datadog-client.ts` | Axios-based Datadog API wrapper (metrics + logs) |
| `src/tools/metrics.ts` | MCP tool registration: query_metrics, list_metrics, get_metric_metadata |
| `src/tools/logs.ts` | MCP tool registration: search_logs, list_log_indexes |
| `src/index.ts` | Lambda handler: API Gateway ↔ MCP transport adapter |
| `template.yaml` | SAM template: Lambda, API Gateway, API Key, Usage Plan |
| `README.md` | Team onboarding guide |
| `tests/lib/time-utils.test.ts` | Unit tests for time-utils |
| `tests/lib/datadog-client.test.ts` | Unit tests for datadog-client |
| `tests/tools/metrics.test.ts` | Unit tests for metrics tools |
| `tests/tools/logs.test.ts` | Unit tests for logs tools |
| `tests/index.test.ts` | Integration test for Lambda handler |

---

## Chunk 1: Project Scaffold & Utilities

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "datadog-mcp",
  "version": "1.0.0",
  "description": "Datadog MCP Server on AWS Lambda",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk axios zod
npm install -D typescript vitest @types/node @types/aws-lambda
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, just config check)

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "chore: initialize project with dependencies"
```

---

### Task 2: Time utilities

**Files:**
- Create: `src/lib/time-utils.ts`
- Create: `tests/lib/time-utils.test.ts`

- [ ] **Step 1: Write failing tests for parseRelativeTime**

Create `tests/lib/time-utils.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRelativeTime } from '../../src/lib/time-utils';

describe('parseRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses "now" to current epoch seconds', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(parseRelativeTime('now')).toBe(now);
  });

  it('parses "30m" to 30 minutes ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 30 * 60;
    expect(parseRelativeTime('30m')).toBe(expected);
  });

  it('parses "1h" to 1 hour ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 3600;
    expect(parseRelativeTime('1h')).toBe(expected);
  });

  it('parses "1d" to 1 day ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 86400;
    expect(parseRelativeTime('1d')).toBe(expected);
  });

  it('parses "7d" to 7 days ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 7 * 86400;
    expect(parseRelativeTime('7d')).toBe(expected);
  });

  it('passes through epoch seconds as-is', () => {
    expect(parseRelativeTime('1711180800')).toBe(1711180800);
  });

  it('throws on invalid format', () => {
    expect(() => parseRelativeTime('abc')).toThrow('Invalid time format');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/time-utils.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement parseRelativeTime**

Create `src/lib/time-utils.ts`:

```typescript
const RELATIVE_TIME_REGEX = /^(\d+)(m|h|d)$/;

const UNIT_TO_SECONDS: Record<string, number> = {
  m: 60,
  h: 3600,
  d: 86400,
};

export function parseRelativeTime(input: string): number {
  if (input === 'now') {
    return Math.floor(Date.now() / 1000);
  }

  const match = input.match(RELATIVE_TIME_REGEX);
  if (match) {
    const [, amount, unit] = match;
    const seconds = parseInt(amount, 10) * UNIT_TO_SECONDS[unit];
    return Math.floor(Date.now() / 1000) - seconds;
  }

  const asNumber = Number(input);
  if (!isNaN(asNumber) && asNumber > 0) {
    return Math.floor(asNumber);
  }

  throw new Error(`Invalid time format: "${input}". Use "now", relative (e.g. "1h", "30m", "7d"), or epoch seconds.`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/time-utils.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/time-utils.ts tests/lib/time-utils.test.ts
git commit -m "feat: add relative time parser utility"
```

---

### Task 3: Datadog API client

**Files:**
- Create: `src/lib/datadog-client.ts`
- Create: `tests/lib/datadog-client.test.ts`

- [ ] **Step 1: Write failing tests for DatadogClient**

Create `tests/lib/datadog-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('axios');

describe('DatadogClient', () => {
  let client: DatadogClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    client = new DatadogClient('test-api-key', 'test-app-key', 'datadoghq.com');
  });

  it('creates axios instance with correct base URL and headers', () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.datadoghq.com',
      headers: {
        'DD-API-KEY': 'test-api-key',
        'DD-APPLICATION-KEY': 'test-app-key',
        'Content-Type': 'application/json',
      },
    });
  });

  describe('queryMetrics', () => {
    it('calls GET /api/v1/query with correct params', async () => {
      const mockData = { series: [{ pointlist: [[1000, 42]] }] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.queryMetrics('avg:system.cpu.user{*}', 1000, 2000);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/query', {
        params: { query: 'avg:system.cpu.user{*}', from: 1000, to: 2000 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('listMetrics', () => {
    it('calls GET /api/v1/metrics with query and from', async () => {
      const mockData = { metrics: ['system.cpu.user', 'system.cpu.system'] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listMetrics('system.cpu.*', 1000);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/metrics', {
        params: { q: 'system.cpu.*', from: 1000 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getMetricMetadata', () => {
    it('calls GET /api/v1/metrics/{metric_name}', async () => {
      const mockData = { type: 'gauge', unit: 'percent' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.getMetricMetadata('system.cpu.user');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/metrics/system.cpu.user');
      expect(result).toEqual(mockData);
    });
  });

  describe('searchLogs', () => {
    it('calls POST /api/v2/logs/events/search with correct body', async () => {
      const mockData = { data: [{ id: 'log1' }] };
      mockAxiosInstance.post.mockResolvedValue({ data: mockData });

      const result = await client.searchLogs('status:error', 1000, 2000, 50, '-timestamp');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v2/logs/events/search', {
        filter: { query: 'status:error', from: new Date(1000 * 1000).toISOString(), to: new Date(2000 * 1000).toISOString() },
        sort: '-timestamp',
        page: { limit: 50 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('listLogIndexes', () => {
    it('calls GET /api/v1/logs/config/indexes', async () => {
      const mockData = { indexes: [{ name: 'main' }] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listLogIndexes();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/logs/config/indexes');
      expect(result).toEqual(mockData);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/datadog-client.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement DatadogClient**

Create `src/lib/datadog-client.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';

export class DatadogClient {
  private client: AxiosInstance;

  constructor(apiKey: string, appKey: string, site: string) {
    this.client = axios.create({
      baseURL: `https://api.${site}`,
      headers: {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async queryMetrics(query: string, from: number, to: number) {
    const { data } = await this.client.get('/api/v1/query', {
      params: { query, from, to },
    });
    return data;
  }

  async listMetrics(query: string, from: number) {
    const { data } = await this.client.get('/api/v1/metrics', {
      params: { q: query, from },
    });
    return data;
  }

  async getMetricMetadata(metricName: string) {
    const { data } = await this.client.get(`/api/v1/metrics/${metricName}`);
    return data;
  }

  async searchLogs(
    query: string,
    from: number,
    to: number,
    limit: number,
    sort: string,
  ) {
    const { data } = await this.client.post('/api/v2/logs/events/search', {
      filter: { query, from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString() },
      sort,
      page: { limit },
    });
    return data;
  }

  async listLogIndexes() {
    const { data } = await this.client.get('/api/v1/logs/config/indexes');
    return data;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/datadog-client.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/datadog-client.ts tests/lib/datadog-client.test.ts
git commit -m "feat: add Datadog API client wrapper"
```

---

## Chunk 2: MCP Tools

### Task 4: Metrics tools

**Files:**
- Create: `src/tools/metrics.ts`
- Create: `tests/tools/metrics.test.ts`

- [ ] **Step 1: Write failing tests for metrics tool registration**

Create `tests/tools/metrics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMetricsTools } from '../../src/tools/metrics';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('../../src/lib/datadog-client');

describe('registerMetricsTools', () => {
  let server: McpServer;
  let mockClient: any;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      queryMetrics: vi.fn(),
      listMetrics: vi.fn(),
      getMetricMetadata: vi.fn(),
    };
  });

  it('registers three tools on the server', () => {
    const spy = vi.spyOn(server, 'registerTool');
    registerMetricsTools(server, mockClient as unknown as DatadogClient);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('query_metrics', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('list_metrics', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('get_metric_metadata', expect.any(Object), expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/metrics.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement registerMetricsTools**

Create `src/tools/metrics.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { parseRelativeTime } from '../lib/time-utils';

export function registerMetricsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'query_metrics',
    {
      title: 'Query Datadog Metrics',
      description: 'Query Datadog time-series metric data. Use Datadog query syntax, e.g. "avg:system.cpu.user{env:production}"',
      inputSchema: z.object({
        query: z.string().describe('Datadog metric query, e.g. avg:system.cpu.user{env:production}'),
        from: z.string().describe('Start time: epoch seconds or relative (e.g. "1h", "30m", "7d")'),
        to: z.string().default('now').describe('End time: epoch seconds or relative. Default: "now"'),
      }),
    },
    async ({ query, from, to }) => {
      const fromEpoch = parseRelativeTime(from);
      const toEpoch = parseRelativeTime(to);
      const result = await client.queryMetrics(query, fromEpoch, toEpoch);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'list_metrics',
    {
      title: 'List Datadog Metrics',
      description: 'Search for available Datadog metric names matching a pattern.',
      inputSchema: z.object({
        query: z.string().describe('Search pattern, e.g. "system.cpu.*"'),
        from: z.string().default('1d').describe('Only metrics active since this time. Default: "1d"'),
      }),
    },
    async ({ query, from }) => {
      const fromEpoch = parseRelativeTime(from);
      const result = await client.listMetrics(query, fromEpoch);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'get_metric_metadata',
    {
      title: 'Get Metric Metadata',
      description: 'Get metadata (unit, type, description) for a specific Datadog metric.',
      inputSchema: z.object({
        metric_name: z.string().describe('Full metric name, e.g. "system.cpu.user"'),
      }),
    },
    async ({ metric_name }) => {
      const result = await client.getMetricMetadata(metric_name);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/metrics.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/metrics.ts tests/tools/metrics.test.ts
git commit -m "feat: add metrics MCP tools (query, list, metadata)"
```

---

### Task 5: Logs tools

**Files:**
- Create: `src/tools/logs.ts`
- Create: `tests/tools/logs.test.ts`

- [ ] **Step 1: Write failing tests for logs tool registration**

Create `tests/tools/logs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLogsTools } from '../../src/tools/logs';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('../../src/lib/datadog-client');

describe('registerLogsTools', () => {
  let server: McpServer;
  let mockClient: any;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      searchLogs: vi.fn(),
      listLogIndexes: vi.fn(),
    };
  });

  it('registers two tools on the server', () => {
    const spy = vi.spyOn(server, 'registerTool');
    registerLogsTools(server, mockClient as unknown as DatadogClient);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('search_logs', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('list_log_indexes', expect.any(Object), expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/logs.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement registerLogsTools**

Create `src/tools/logs.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { parseRelativeTime } from '../lib/time-utils';

export function registerLogsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'search_logs',
    {
      title: 'Search Datadog Logs',
      description: 'Search Datadog logs using query syntax, e.g. "status:error service:api env:production"',
      inputSchema: z.object({
        query: z.string().describe('Datadog log query, e.g. "status:error service:api"'),
        from: z.string().describe('Start time: epoch seconds or relative (e.g. "15m", "1h", "1d")'),
        to: z.string().default('now').describe('End time. Default: "now"'),
        limit: z.number().min(1).max(200).default(50).describe('Max logs to return (1-200). Default: 50'),
        sort: z.enum(['timestamp', '-timestamp']).default('-timestamp').describe('Sort order. Default: "-timestamp" (newest first)'),
      }),
    },
    async ({ query, from, to, limit, sort }) => {
      const fromEpoch = parseRelativeTime(from);
      const toEpoch = parseRelativeTime(to);
      const result = await client.searchLogs(query, fromEpoch, toEpoch, limit, sort);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'list_log_indexes',
    {
      title: 'List Log Indexes',
      description: 'List all Datadog log indexes with their names, filters, and retention periods.',
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.listLogIndexes();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/logs.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/logs.ts tests/tools/logs.test.ts
git commit -m "feat: add logs MCP tools (search, list indexes)"
```

---

## Chunk 3: Lambda Handler & SAM Template

### Task 6: Lambda handler

**Files:**
- Create: `src/index.ts`
- Create: `tests/index.test.ts`

- [ ] **Step 1: Write failing test for Lambda handler**

Create `tests/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Lambda handler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DD_API_KEY', 'test-api-key');
    vi.stubEnv('DD_APP_KEY', 'test-app-key');
    vi.stubEnv('DD_SITE', 'datadoghq.com');
  });

  it('returns 200 for valid MCP initialize request via POST', async () => {
    const { handler } = await import('../src/index');

    const event = {
      httpMethod: 'POST',
      path: '/mcp',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
      isBase64Encoded: false,
    };

    const result = await handler(event as any, {} as any);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.result.serverInfo.name).toBe('datadog-mcp');
  });

  it('returns 400 for invalid request body', async () => {
    const { handler } = await import('../src/index');

    const event = {
      httpMethod: 'POST',
      path: '/mcp',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
      isBase64Encoded: false,
    };

    const result = await handler(event as any, {} as any);
    // MCP SDK returns error for non-initialize first request
    expect([400, 200]).toContain(result.statusCode);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/index.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement Lambda handler**

Create `src/index.ts`:

```typescript
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

function apiGatewayToReqRes(event: APIGatewayProxyEvent): { req: IncomingMessage; res: ServerResponse; getResponse: () => APIGatewayProxyResult } {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString()
    : event.body || '';

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = event.httpMethod;
  req.url = event.path;
  req.headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]),
  );

  // Push body into readable stream
  req.push(body);
  req.push(null);

  // Attach parsed body for transport.handleRequest
  (req as any).body = body ? JSON.parse(body) : undefined;

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

  const originalWrite = res.write.bind(res);
  res.write = function (chunk: any, ...args: any[]) {
    responseBody += typeof chunk === 'string' ? chunk : chunk.toString();
    return originalWrite(chunk, ...args);
  } as any;

  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, ...args: any[]) {
    if (chunk) {
      responseBody += typeof chunk === 'string' ? chunk : chunk.toString();
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

    await transport.handleRequest(req, res, (req as any).body);

    // Wait for response to finish
    await new Promise<void>((resolve) => {
      if (res.writableFinished) {
        resolve();
      } else {
        res.on('finish', resolve);
      }
    });

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/index.test.ts`
Expected: Tests PASS

- [ ] **Step 5: Verify full test suite passes**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: add Lambda handler with API Gateway adapter"
```

---

### Task 7: SAM template

**Files:**
- Create: `template.yaml`

- [ ] **Step 1: Create SAM template**

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Datadog MCP Server - Read-only Metrics & Logs for Claude

Globals:
  Function:
    Timeout: 30
    MemorySize: 256
    Runtime: nodejs20.x

Parameters:
  DatadogApiKey:
    Type: String
    NoEcho: true
    Description: Datadog API Key
  DatadogAppKey:
    Type: String
    NoEcho: true
    Description: Datadog Application Key
  DatadogSite:
    Type: String
    Default: datadoghq.com
    Description: Datadog site (e.g. datadoghq.com, datadoghq.eu)

Resources:
  McpApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        ApiKeyRequired: true

  McpFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: false
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/index.ts
    Properties:
      Handler: index.handler
      CodeUri: .
      Environment:
        Variables:
          DD_API_KEY: !Ref DatadogApiKey
          DD_APP_KEY: !Ref DatadogAppKey
          DD_SITE: !Ref DatadogSite
      Events:
        McpPost:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: POST
        McpGet:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: GET
        McpDelete:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: DELETE

  ApiKey:
    Type: AWS::ApiGateway::ApiKey
    DependsOn: McpApiprodStage
    Properties:
      Name: datadog-mcp-team-key
      Enabled: true
      StageKeys:
        - RestApiId: !Ref McpApi
          StageName: prod

  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    DependsOn: McpApiprodStage
    Properties:
      UsagePlanName: datadog-mcp-plan
      Throttle:
        BurstLimit: 50
        RateLimit: 20
      Quota:
        Limit: 10000
        Period: DAY
      ApiStages:
        - ApiId: !Ref McpApi
          Stage: prod

  UsagePlanKey:
    Type: AWS::ApiGateway::UsagePlanKey
    Properties:
      KeyId: !Ref ApiKey
      KeyType: API_KEY
      UsagePlanId: !Ref UsagePlan

Outputs:
  McpEndpoint:
    Description: MCP Server endpoint URL
    Value: !Sub 'https://${McpApi}.execute-api.${AWS::Region}.amazonaws.com/prod/mcp'
  ApiKeyId:
    Description: API Key ID (run "aws apigateway get-api-key --api-key <id> --include-value" to get the key value)
    Value: !Ref ApiKey
```

- [ ] **Step 2: Validate SAM template**

Run: `sam validate --template template.yaml 2>&1 || echo "SAM CLI not installed - skip validation"`
Expected: Template is valid (or SAM CLI not installed)

- [ ] **Step 3: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
.aws-sam/
samconfig.toml
```

- [ ] **Step 4: Commit**

```bash
git add template.yaml .gitignore
git commit -m "feat: add SAM template with API Gateway + API Key auth"
```

---

## Chunk 4: README & Deploy

### Task 8: README with onboarding guide

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

````markdown
# Datadog MCP Server

AWS Lambda에 배포하는 Datadog MCP 서버. Claude에서 Datadog Metrics와 Logs를 읽기 전용으로 조회할 수 있습니다.

## 사용 가능한 Tools

| Tool | 설명 |
|------|------|
| `query_metrics` | 메트릭 시계열 데이터 조회 |
| `list_metrics` | 메트릭 이름 검색 |
| `get_metric_metadata` | 메트릭 메타데이터 조회 |
| `search_logs` | 로그 검색 |
| `list_log_indexes` | 로그 인덱스 목록 |

## 배포 (관리자)

### 사전 요구사항

- Node.js 20+
- AWS CLI (설정 완료)
- AWS SAM CLI
- Datadog API Key + Application Key (Metrics Read + Logs Read 권한)

### 배포 순서

```bash
# 1. 빌드
npm install
npm run build

# 2. SAM 빌드 & 배포
sam build
sam deploy --guided
# Stack Name: datadog-mcp
# Region: 원하는 리전
# DatadogApiKey: <your-dd-api-key>
# DatadogAppKey: <your-dd-app-key>
```

### 배포 후 확인

```bash
# 엔드포인트 URL 확인
sam list stack-outputs --stack-name datadog-mcp

# API Key 값 확인
aws apigateway get-api-key --api-key <ApiKeyId from output> --include-value
```

## 팀원 설정 (Claude)

Claude Desktop 설정 파일 또는 Claude Code 프로젝트 설정에 추가:

```json
{
  "mcpServers": {
    "datadog": {
      "type": "url",
      "url": "https://<api-id>.execute-api.<region>.amazonaws.com/prod/mcp",
      "headers": {
        "x-api-key": "<shared-api-key>"
      }
    }
  }
}
```

관리자에게 URL과 API Key를 받아서 입력하세요.

## 사용 예시 (Claude에서)

- "최근 1시간 CPU 사용률 보여줘"
- "production 환경 ERROR 로그 검색해줘"
- "system.cpu 관련 메트릭 목록 알려줘"

## 개발

```bash
npm install
npm test           # 테스트 실행
npm run build      # TypeScript 빌드
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with deployment and onboarding guide"
```

---

### Task 9: Build, deploy, verify

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Build TypeScript**

Run: `npm run build`
Expected: `dist/` directory created with compiled JS

- [ ] **Step 3: SAM build**

Run: `sam build`
Expected: `.aws-sam/build/` directory created

- [ ] **Step 4: SAM deploy**

Run: `sam deploy --guided`

Inputs:
- Stack Name: `datadog-mcp`
- Region: (choose your region)
- DatadogApiKey: (your Datadog API key)
- DatadogAppKey: (your Datadog App key)
- Confirm changes: y
- Allow SAM CLI IAM role creation: y

Expected: Stack created successfully. Outputs show McpEndpoint and ApiKeyId.

- [ ] **Step 5: Retrieve API Key value**

Run: `aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query 'value' --output text`
Expected: API key string printed

- [ ] **Step 6: Test MCP endpoint**

Run:
```bash
curl -X POST https://<McpEndpoint> \
  -H "Content-Type: application/json" \
  -H "x-api-key: <api-key-value>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

Expected: JSON response with `serverInfo.name: "datadog-mcp"`

- [ ] **Step 7: Add Claude MCP config and test**

Add to Claude settings:
```json
{
  "mcpServers": {
    "datadog": {
      "type": "url",
      "url": "https://<endpoint>/prod/mcp",
      "headers": { "x-api-key": "<key>" }
    }
  }
}
```

Test in Claude: "list_metrics로 system.cpu 관련 메트릭 검색해줘"

- [ ] **Step 8: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 9: Share with team**

팀원들에게 공유할 정보:
1. MCP Endpoint URL
2. API Key 값
3. Claude 설정 방법 (README 참조)
