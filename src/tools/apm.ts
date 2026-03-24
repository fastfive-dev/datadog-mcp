import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { parseRelativeTime } from '../lib/time-utils';
import { formatToolError } from '../lib/tool-error';

export function registerApmTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'list_services',
    {
      title: 'List APM Services',
      description: 'List all APM services and their dependencies from the Datadog service map.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await client.listServices();
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'search_spans',
    {
      title: 'Search APM Spans/Traces',
      description:
        'Search APM spans (traces) using Datadog query syntax, e.g. "service:api @http.status_code:500 env:production"',
      inputSchema: z.object({
        query: z.string().min(1).describe('Span search query, e.g. "service:api @duration:>1s"'),
        from: z.string().min(1).describe('Start time: epoch seconds or relative (e.g. "15m", "1h", "1d")'),
        to: z.string().default('now').describe('End time. Default: "now"'),
        limit: z.number().min(1).max(1000).default(50).describe('Max spans to return (1-1000). Default: 50'),
        sort: z
          .enum(['timestamp', '-timestamp'])
          .default('-timestamp')
          .describe('Sort order. Default: "-timestamp" (newest first)'),
      }),
    },
    async ({ query, from, to, limit, sort }) => {
      try {
        const fromEpoch = parseRelativeTime(from);
        const toEpoch = parseRelativeTime(to);
        const result = await client.searchSpans(query, fromEpoch, toEpoch, limit, sort);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_service_summary',
    {
      title: 'Get APM Service Summary',
      description:
        'Get performance summary (latency, error rate, throughput) for a specific APM service in an environment.',
      inputSchema: z.object({
        env: z.string().min(1).describe('Environment name, e.g. "production"'),
        service: z.string().min(1).describe('Service name, e.g. "api-gateway"'),
        from: z.string().min(1).describe('Start time: epoch seconds or relative (e.g. "1h", "6h", "1d")'),
        to: z.string().default('now').describe('End time. Default: "now"'),
      }),
    },
    async ({ env, service, from, to }) => {
      try {
        const fromEpoch = parseRelativeTime(from);
        const toEpoch = parseRelativeTime(to);
        const result = await client.getServiceSummary(env, service, fromEpoch, toEpoch);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );
}
