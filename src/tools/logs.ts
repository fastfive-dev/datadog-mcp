import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { parseRelativeTime } from '../lib/time-utils';
import { formatToolError } from '../lib/tool-error';

export function registerLogsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'search_logs',
    {
      title: 'Search Datadog Logs',
      description: 'Search Datadog logs using query syntax, e.g. "status:error service:api env:production"',
      inputSchema: z.object({
        query: z.string().min(1).describe('Datadog log query, e.g. "status:error service:api"'),
        from: z.string().min(1).describe('Start time: epoch seconds or relative (e.g. "15m", "1h", "1d")'),
        to: z.string().default('now').describe('End time. Default: "now"'),
        limit: z.number().min(1).max(200).default(50).describe('Max logs to return (1-200). Default: 50'),
        sort: z.enum(['timestamp', '-timestamp']).default('-timestamp').describe('Sort order. Default: "-timestamp" (newest first)'),
      }),
    },
    async ({ query, from, to, limit, sort }) => {
      try {
        const fromEpoch = parseRelativeTime(from);
        const toEpoch = parseRelativeTime(to);
        const result = await client.searchLogs(query, fromEpoch, toEpoch, limit, sort);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_log_indexes',
    {
      title: 'List Log Indexes',
      description: 'List all Datadog log indexes with their names, filters, and retention periods.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await client.listLogIndexes();
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );
}
