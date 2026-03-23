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
