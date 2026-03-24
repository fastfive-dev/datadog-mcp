import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { parseRelativeTime } from '../lib/time-utils';
import { formatToolError } from '../lib/tool-error';

export function registerMetricsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'query_metrics',
    {
      title: 'Query Datadog Metrics',
      description: 'Query Datadog time-series metric data. Use Datadog query syntax, e.g. "avg:system.cpu.user{env:production}"',
      inputSchema: z.object({
        query: z.string().min(1).describe('Datadog metric query, e.g. avg:system.cpu.user{env:production}'),
        from: z.string().min(1).describe('Start time: epoch seconds or relative (e.g. "1h", "30m", "7d")'),
        to: z.string().default('now').describe('End time: epoch seconds or relative. Default: "now"'),
      }),
    },
    async ({ query, from, to }) => {
      try {
        const fromEpoch = parseRelativeTime(from);
        const toEpoch = parseRelativeTime(to);
        const result = await client.queryMetrics(query, fromEpoch, toEpoch);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_metrics',
    {
      title: 'List Datadog Metrics',
      description: 'Search for available Datadog metric names matching a pattern.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search pattern, e.g. "system.cpu.*"'),
        from: z.string().default('1d').describe('Only metrics active since this time. Default: "1d"'),
      }),
    },
    async ({ query, from }) => {
      try {
        const fromEpoch = parseRelativeTime(from);
        const result = await client.listMetrics(query, fromEpoch);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_metric_metadata',
    {
      title: 'Get Metric Metadata',
      description: 'Get metadata (unit, type, description) for a specific Datadog metric.',
      inputSchema: z.object({
        metric_name: z.string().min(1).describe('Full metric name, e.g. "system.cpu.user"'),
      }),
    },
    async ({ metric_name }) => {
      try {
        const result = await client.getMetricMetadata(metric_name);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );
}
