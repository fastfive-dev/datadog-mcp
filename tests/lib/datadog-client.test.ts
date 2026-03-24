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

  it('throws for disallowed DD_SITE values', () => {
    expect(() => new DatadogClient('key', 'app', 'evil.com')).toThrow('Invalid DD_SITE');
  });

  it('accepts all official Datadog sites', () => {
    for (const site of ['datadoghq.com', 'us3.datadoghq.com', 'us5.datadoghq.com', 'datadoghq.eu', 'ap1.datadoghq.com', 'ddog-gov.com']) {
      expect(() => new DatadogClient('key', 'app', site)).not.toThrow();
    }
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

  // --- Monitors ---

  describe('listMonitors', () => {
    it('calls GET /api/v1/monitor with params', async () => {
      const mockData = [{ id: 1, name: 'CPU Alert' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listMonitors({ groupStates: 'alert', tags: 'env:prod', pageSize: 10, page: 0 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/monitor', {
        params: { group_states: 'alert', monitor_tags: 'env:prod', page_size: 10, page: 0 },
      });
      expect(result).toEqual(mockData);
    });

    it('omits empty optional params', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });
      await client.listMonitors();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/monitor', { params: {} });
    });
  });

  describe('getMonitor', () => {
    it('calls GET /api/v1/monitor/{id}', async () => {
      const mockData = { id: 123, name: 'Test Monitor' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.getMonitor(123, { groupStates: 'alert,warn' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/monitor/123', {
        params: { group_states: 'alert,warn' },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('searchMonitors', () => {
    it('calls GET /api/v1/monitor/search', async () => {
      const mockData = { monitors: [], metadata: { total_count: 0 } };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.searchMonitors('type:metric', 0, 30);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/monitor/search', {
        params: { query: 'type:metric', page: 0, per_page: 30 },
      });
      expect(result).toEqual(mockData);
    });
  });

  // --- Downtimes ---

  describe('listDowntimes', () => {
    it('calls GET /api/v2/downtime', async () => {
      const mockData = { data: [] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listDowntimes();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v2/downtime');
      expect(result).toEqual(mockData);
    });
  });

  // --- Incidents ---

  describe('listIncidents', () => {
    it('calls GET /api/v2/incidents with pagination', async () => {
      const mockData = { data: [{ id: 'inc-1' }] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listIncidents(10, 5);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v2/incidents', {
        params: { 'page[size]': 10, 'page[offset]': 5 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getIncident', () => {
    it('calls GET /api/v2/incidents/{id}', async () => {
      const mockData = { data: { id: 'abc-123', type: 'incidents' } };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.getIncident('abc-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v2/incidents/abc-123');
      expect(result).toEqual(mockData);
    });
  });

  // --- APM ---

  describe('listServices', () => {
    it('calls GET /api/v1/service_dependencies/mapping', async () => {
      const mockData = [{ service_name: 'api' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listServices();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/service_dependencies/mapping');
      expect(result).toEqual(mockData);
    });
  });

  describe('searchSpans', () => {
    it('calls POST /api/v2/spans/events/search with correct body', async () => {
      const mockData = { data: [{ spanId: 's1' }] };
      mockAxiosInstance.post.mockResolvedValue({ data: mockData });

      const result = await client.searchSpans('service:api', 1000, 2000, 50, '-timestamp');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v2/spans/events/search', {
        filter: {
          query: 'service:api',
          from: new Date(1000 * 1000).toISOString(),
          to: new Date(2000 * 1000).toISOString(),
        },
        sort: '-timestamp',
        page: { limit: 50 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getServiceSummary', () => {
    it('calls GET /api/v1/trace/stats/summary', async () => {
      const mockData = { hits: 1000, errors: 5, latency_avg: 120 };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.getServiceSummary('production', 'api-gateway', 1000, 2000);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/trace/stats/summary', {
        params: { env: 'production', service: 'api-gateway', start: 1000, end: 2000 },
      });
      expect(result).toEqual(mockData);
    });
  });
});
