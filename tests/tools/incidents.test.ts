import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerIncidentsTools } from '../../src/tools/incidents';
import { DatadogClient } from '../../src/lib/datadog-client';

vi.mock('../../src/lib/datadog-client');

describe('registerIncidentsTools', () => {
  let server: McpServer;
  let mockClient: any;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      listIncidents: vi.fn(),
      getIncident: vi.fn(),
      listDowntimes: vi.fn(),
    };
  });

  it('registers three tools on the server', () => {
    const spy = vi.spyOn(server, 'registerTool');
    registerIncidentsTools(server, mockClient as unknown as DatadogClient);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('list_incidents', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('get_incident', expect.any(Object), expect.any(Function));
    expect(spy).toHaveBeenCalledWith('list_downtimes', expect.any(Object), expect.any(Function));
  });
});
