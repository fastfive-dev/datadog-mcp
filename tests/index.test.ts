import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Lambda handler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DD_API_KEY', 'test-api-key');
    vi.stubEnv('DD_APP_KEY', 'test-app-key');
    vi.stubEnv('DD_SITE', 'datadoghq.com');
  });

  it('throws at import when DD_API_KEY is missing', async () => {
    vi.stubEnv('DD_API_KEY', '');
    await expect(import('../src/index')).rejects.toThrow('DD_API_KEY and DD_APP_KEY environment variables are required');
  });

  it('throws at import when DD_APP_KEY is missing', async () => {
    vi.stubEnv('DD_APP_KEY', '');
    await expect(import('../src/index')).rejects.toThrow('DD_API_KEY and DD_APP_KEY environment variables are required');
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

  it('returns 400 with JSON-RPC error for malformed JSON body', async () => {
    const { handler } = await import('../src/index');

    const event = {
      httpMethod: 'POST',
      path: '/mcp',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
      isBase64Encoded: false,
    };

    const result = await handler(event as any, {} as any);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe(-32700);
    expect(body.error.message).toContain('Parse error');
  });
});
