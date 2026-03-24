import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerApmTools } from '../../src/tools/apm';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('../../src/lib/datadog-client');

describe('registerApmTools', () => {
  let server: McpServer;
  let mockClient: any;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      listServices: vi.fn(),
      searchSpans: vi.fn(),
      getServiceSummary: vi.fn(),
    };
  });

  it('registers three tools on the server', () => {
    const spy = vi.spyOn(server, 'registerTool');
    registerApmTools(server, mockClient as unknown as DatadogClient);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('list_services', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('search_spans', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('get_service_summary', expect.any(Object), expect.any(Function));
  });
});
