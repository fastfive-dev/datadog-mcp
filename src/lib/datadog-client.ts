import axios, { AxiosInstance } from 'axios';

const ALLOWED_DD_SITES = new Set([
  'datadoghq.com',
  'us3.datadoghq.com',
  'us5.datadoghq.com',
  'datadoghq.eu',
  'ap1.datadoghq.com',
  'ddog-gov.com',
]);

export class DatadogClient {
  private client: AxiosInstance;

  constructor(apiKey: string, appKey: string, site: string) {
    if (!ALLOWED_DD_SITES.has(site)) {
      throw new Error(
        `Invalid DD_SITE "${site}". Allowed: ${[...ALLOWED_DD_SITES].join(', ')}`,
      );
    }
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
    const { data } = await this.client.get(`/api/v1/metrics/${encodeURIComponent(metricName)}`);
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

  // --- Monitors ---

  async listMonitors(params: { groupStates?: string; tags?: string; pageSize?: number; page?: number } = {}) {
    const { data } = await this.client.get('/api/v1/monitor', {
      params: {
        ...(params.groupStates && { group_states: params.groupStates }),
        ...(params.tags && { monitor_tags: params.tags }),
        ...(params.pageSize !== undefined && { page_size: params.pageSize }),
        ...(params.page !== undefined && { page: params.page }),
      },
    });
    return data;
  }

  async getMonitor(monitorId: number, params: { groupStates?: string } = {}) {
    const { data } = await this.client.get(`/api/v1/monitor/${monitorId}`, {
      params: {
        ...(params.groupStates && { group_states: params.groupStates }),
      },
    });
    return data;
  }

  async searchMonitors(query: string, page?: number, perPage?: number) {
    const { data } = await this.client.get('/api/v1/monitor/search', {
      params: { query, ...(page !== undefined && { page }), ...(perPage && { per_page: perPage }) },
    });
    return data;
  }

  // --- Downtimes ---

  async listDowntimes() {
    const { data } = await this.client.get('/api/v2/downtime');
    return data;
  }

  // --- Incidents ---

  async listIncidents(pageSize: number = 25, pageOffset: number = 0) {
    const { data } = await this.client.get('/api/v2/incidents', {
      params: { 'page[size]': pageSize, 'page[offset]': pageOffset },
    });
    return data;
  }

  async getIncident(incidentId: string) {
    const { data } = await this.client.get(`/api/v2/incidents/${encodeURIComponent(incidentId)}`);
    return data;
  }

  // --- APM / Traces ---

  async listServices() {
    const { data } = await this.client.get('/api/v1/service_dependencies/mapping');
    return data;
  }

  async searchSpans(
    query: string,
    from: number,
    to: number,
    limit: number,
    sort: string,
  ) {
    const { data } = await this.client.post('/api/v2/spans/events/search', {
      filter: {
        query,
        from: new Date(from * 1000).toISOString(),
        to: new Date(to * 1000).toISOString(),
      },
      sort,
      page: { limit },
    });
    return data;
  }

  async getServiceSummary(
    env: string,
    service: string,
    from: number,
    to: number,
  ) {
    const { data } = await this.client.get('/api/v1/trace/stats/summary', {
      params: { env, service, start: from, end: to },
    });
    return data;
  }
}
