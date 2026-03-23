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
