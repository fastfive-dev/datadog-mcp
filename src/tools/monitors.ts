import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { formatToolError } from '../lib/tool-error';

export function registerMonitorsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'list_monitors',
    {
      title: 'List Datadog Monitors',
      description: 'List monitors (alerts) configured in Datadog. Optionally filter by tags or state.',
      inputSchema: z.object({
        group_states: z
          .string()
          .optional()
          .describe('Comma-separated monitor states to filter: "alert", "warn", "no data", "ok"'),
        tags: z.string().optional().describe('Comma-separated monitor tags to filter, e.g. "service:api,env:prod"'),
        page_size: z.number().min(1).max(1000).default(50).describe('Results per page (1-1000). Default: 50'),
        page: z.number().min(0).default(0).describe('Page number (0-indexed). Default: 0'),
      }),
    },
    async ({ group_states, tags, page_size, page }) => {
      try {
        const result = await client.listMonitors({ groupStates: group_states, tags, pageSize: page_size, page });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_monitor',
    {
      title: 'Get Datadog Monitor',
      description: 'Get detailed information about a specific Datadog monitor by ID.',
      inputSchema: z.object({
        monitor_id: z.number().int().positive().describe('The monitor ID'),
        group_states: z
          .string()
          .optional()
          .describe('Comma-separated group states to include: "alert", "warn", "no data", "ok"'),
      }),
    },
    async ({ monitor_id, group_states }) => {
      try {
        const result = await client.getMonitor(monitor_id, { groupStates: group_states });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'search_monitors',
    {
      title: 'Search Datadog Monitors',
      description:
        'Search monitors using Datadog query syntax, e.g. "type:metric status:alert service:api"',
      inputSchema: z.object({
        query: z.string().min(1).describe('Monitor search query, e.g. "type:metric status:alert"'),
        per_page: z.number().min(1).max(100).default(30).describe('Results per page (1-100). Default: 30'),
        page: z.number().min(0).default(0).describe('Page number (0-indexed). Default: 0'),
      }),
    },
    async ({ query, per_page, page }) => {
      try {
        const result = await client.searchMonitors(query, page, per_page);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );
}
