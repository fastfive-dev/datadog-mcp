import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatadogClient } from '../../src/lib/datadog-client';
import { registerMetricsTools } from '../../src/tools/metrics';
import { registerLogsTools } from '../../src/tools/logs';
import { registerMonitorsTools } from '../../src/tools/monitors';
import { registerIncidentsTools } from '../../src/tools/incidents';
import { registerApmTools } from '../../src/tools/apm';

vi.mock('../../src/lib/datadog-client');

/**
 * Captures tool handlers during registration so we can invoke them directly.
 */
function captureHandlers(
  registerFn: (server: McpServer, client: DatadogClient) => void,
  mockClient: any,
): Record<string, Function> {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const handlers: Record<string, Function> = {};
  const origRegister = server.registerTool.bind(server);
  vi.spyOn(server, 'registerTool').mockImplementation((name: string, _def: any, handler: any) => {
    handlers[name] = handler;
    return origRegister(name, _def, handler);
  });
  registerFn(server, mockClient as unknown as DatadogClient);
  return handlers;
}

describe('Tool handler execution', () => {
  let mockClient: Record<string, any>;

  beforeEach(() => {
    mockClient = {
      queryMetrics: vi.fn().mockResolvedValue({ series: [] }),
      listMetrics: vi.fn().mockResolvedValue({ metrics: [] }),
      getMetricMetadata: vi.fn().mockResolvedValue({ type: 'gauge' }),
      searchLogs: vi.fn().mockResolvedValue({ data: [] }),
      listLogIndexes: vi.fn().mockResolvedValue({ indexes: [] }),
      listMonitors: vi.fn().mockResolvedValue([]),
      getMonitor: vi.fn().mockResolvedValue({ id: 1 }),
      searchMonitors: vi.fn().mockResolvedValue({ monitors: [] }),
      listIncidents: vi.fn().mockResolvedValue({ data: [] }),
      getIncident: vi.fn().mockResolvedValue({ data: {} }),
      listDowntimes: vi.fn().mockResolvedValue({ data: [] }),
      listServices: vi.fn().mockResolvedValue([]),
      searchSpans: vi.fn().mockResolvedValue({ data: [] }),
      getServiceSummary: vi.fn().mockResolvedValue({ hits: 0 }),
    };
  });

  // --- Metrics ---

  describe('query_metrics', () => {
    it('calls client.queryMetrics and returns result', async () => {
      const handlers = captureHandlers(registerMetricsTools, mockClient);
      const result = await handlers['query_metrics']({ query: 'avg:cpu{*}', from: 'now', to: 'now' });
      expect(mockClient.queryMetrics).toHaveBeenCalledTimes(1);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe('text');
    });

    it('returns isError on failure', async () => {
      mockClient.queryMetrics.mockRejectedValue(new Error('timeout'));
      const handlers = captureHandlers(registerMetricsTools, mockClient);
      const result = await handlers['query_metrics']({ query: 'avg:cpu{*}', from: 'now', to: 'now' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    });
  });

  describe('get_metric_metadata', () => {
    it('calls client.getMetricMetadata', async () => {
      const handlers = captureHandlers(registerMetricsTools, mockClient);
      await handlers['get_metric_metadata']({ metric_name: 'system.cpu.user' });
      expect(mockClient.getMetricMetadata).toHaveBeenCalledWith('system.cpu.user');
    });
  });

  // --- Logs ---

  describe('search_logs', () => {
    it('calls client.searchLogs and returns result', async () => {
      const handlers = captureHandlers(registerLogsTools, mockClient);
      const result = await handlers['search_logs']({
        query: 'status:error', from: '1h', to: 'now', limit: 50, sort: '-timestamp',
      });
      expect(mockClient.searchLogs).toHaveBeenCalledTimes(1);
      expect(result.isError).toBeUndefined();
    });

    it('returns isError on failure', async () => {
      mockClient.searchLogs.mockRejectedValue(new Error('forbidden'));
      const handlers = captureHandlers(registerLogsTools, mockClient);
      const result = await handlers['search_logs']({
        query: 'status:error', from: '1h', to: 'now', limit: 50, sort: '-timestamp',
      });
      expect(result.isError).toBe(true);
    });
  });

  describe('list_log_indexes', () => {
    it('returns isError on failure', async () => {
      mockClient.listLogIndexes.mockRejectedValue(new Error('fail'));
      const handlers = captureHandlers(registerLogsTools, mockClient);
      const result = await handlers['list_log_indexes']({});
      expect(result.isError).toBe(true);
    });
  });

  // --- Monitors ---

  describe('list_monitors', () => {
    it('passes params correctly to client', async () => {
      const handlers = captureHandlers(registerMonitorsTools, mockClient);
      await handlers['list_monitors']({ group_states: 'alert', tags: 'env:prod', page_size: 10, page: 0 });
      expect(mockClient.listMonitors).toHaveBeenCalledWith({
        groupStates: 'alert', tags: 'env:prod', pageSize: 10, page: 0,
      });
    });

    it('returns isError on failure', async () => {
      mockClient.listMonitors.mockRejectedValue(new Error('fail'));
      const handlers = captureHandlers(registerMonitorsTools, mockClient);
      const result = await handlers['list_monitors']({ page_size: 50, page: 0 });
      expect(result.isError).toBe(true);
    });
  });

  describe('get_monitor', () => {
    it('calls client.getMonitor with correct args', async () => {
      const handlers = captureHandlers(registerMonitorsTools, mockClient);
      await handlers['get_monitor']({ monitor_id: 42, group_states: 'alert' });
      expect(mockClient.getMonitor).toHaveBeenCalledWith(42, { groupStates: 'alert' });
    });
  });

  describe('search_monitors', () => {
    it('calls client.searchMonitors with correct args', async () => {
      const handlers = captureHandlers(registerMonitorsTools, mockClient);
      await handlers['search_monitors']({ query: 'type:metric', per_page: 30, page: 2 });
      expect(mockClient.searchMonitors).toHaveBeenCalledWith('type:metric', 2, 30);
    });
  });

  // --- Incidents ---

  describe('list_incidents', () => {
    it('calls client.listIncidents with pagination', async () => {
      const handlers = captureHandlers(registerIncidentsTools, mockClient);
      await handlers['list_incidents']({ page_size: 10, page_offset: 5 });
      expect(mockClient.listIncidents).toHaveBeenCalledWith(10, 5);
    });

    it('returns isError on failure', async () => {
      mockClient.listIncidents.mockRejectedValue(new Error('fail'));
      const handlers = captureHandlers(registerIncidentsTools, mockClient);
      const result = await handlers['list_incidents']({ page_size: 25, page_offset: 0 });
      expect(result.isError).toBe(true);
    });
  });

  describe('get_incident', () => {
    it('calls client.getIncident with id', async () => {
      const handlers = captureHandlers(registerIncidentsTools, mockClient);
      await handlers['get_incident']({ incident_id: 'abc-123' });
      expect(mockClient.getIncident).toHaveBeenCalledWith('abc-123');
    });
  });

  describe('list_downtimes', () => {
    it('calls client.listDowntimes', async () => {
      const handlers = captureHandlers(registerIncidentsTools, mockClient);
      await handlers['list_downtimes']({});
      expect(mockClient.listDowntimes).toHaveBeenCalledTimes(1);
    });
  });

  // --- APM ---

  describe('list_services', () => {
    it('calls client.listServices', async () => {
      const handlers = captureHandlers(registerApmTools, mockClient);
      await handlers['list_services']({});
      expect(mockClient.listServices).toHaveBeenCalledTimes(1);
    });

    it('returns isError on failure', async () => {
      mockClient.listServices.mockRejectedValue(new Error('fail'));
      const handlers = captureHandlers(registerApmTools, mockClient);
      const result = await handlers['list_services']({});
      expect(result.isError).toBe(true);
    });
  });

  describe('search_spans', () => {
    it('calls client.searchSpans with correct args', async () => {
      const handlers = captureHandlers(registerApmTools, mockClient);
      await handlers['search_spans']({
        query: 'service:api', from: '1h', to: 'now', limit: 50, sort: '-timestamp',
      });
      expect(mockClient.searchSpans).toHaveBeenCalledTimes(1);
      const [query, , , limit, sort] = mockClient.searchSpans.mock.calls[0];
      expect(query).toBe('service:api');
      expect(limit).toBe(50);
      expect(sort).toBe('-timestamp');
    });
  });

  describe('get_service_summary', () => {
    it('calls client.getServiceSummary with correct args', async () => {
      const handlers = captureHandlers(registerApmTools, mockClient);
      await handlers['get_service_summary']({ env: 'prod', service: 'api', from: '1h', to: 'now' });
      expect(mockClient.getServiceSummary).toHaveBeenCalledTimes(1);
      const [env, service] = mockClient.getServiceSummary.mock.calls[0];
      expect(env).toBe('prod');
      expect(service).toBe('api');
    });

    it('returns isError on failure', async () => {
      mockClient.getServiceSummary.mockRejectedValue(new Error('fail'));
      const handlers = captureHandlers(registerApmTools, mockClient);
      const result = await handlers['get_service_summary']({ env: 'prod', service: 'api', from: '1h', to: 'now' });
      expect(result.isError).toBe(true);
    });
  });
});
