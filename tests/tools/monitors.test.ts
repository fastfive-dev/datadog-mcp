import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMonitorsTools } from '../../src/tools/monitors';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('../../src/lib/datadog-client');

describe('registerMonitorsTools', () => {
  let server: McpServer;
  let mockClient: any;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      listMonitors: vi.fn(),
      getMonitor: vi.fn(),
      searchMonitors: vi.fn(),
    };
  });

  it('registers three tools on the server', () => {
    const spy = vi.spyOn(server, 'registerTool');
    registerMonitorsTools(server, mockClient as unknown as DatadogClient);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('list_monitors', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('get_monitor', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('search_monitors', expect.any(Object), expect.any(Function));
  });
});
