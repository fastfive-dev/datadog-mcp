import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatadogClient } from '../lib/datadog-client';
import { formatToolError } from '../lib/tool-error';

export function registerIncidentsTools(server: McpServer, client: DatadogClient): void {
  server.registerTool(
    'list_incidents',
    {
      title: 'List Datadog Incidents',
      description: 'List incidents in Datadog. Returns active and resolved incidents ordered by creation time.',
      inputSchema: z.object({
        page_size: z.number().min(1).max(100).default(25).describe('Results per page (1-100). Default: 25'),
        page_offset: z.number().min(0).default(0).describe('Offset for pagination. Default: 0'),
      }),
    },
    async ({ page_size, page_offset }) => {
      try {
        const result = await client.listIncidents(page_size, page_offset);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_incident',
    {
      title: 'Get Datadog Incident',
      description: 'Get detailed information about a specific Datadog incident by ID.',
      inputSchema: z.object({
        incident_id: z.string().min(1).describe('The incident ID (UUID)'),
      }),
    },
    async ({ incident_id }) => {
      try {
        const result = await client.getIncident(incident_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_downtimes',
    {
      title: 'List Datadog Downtimes',
      description: 'List all scheduled downtimes in Datadog.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await client.listDowntimes();
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatToolError(error) }], isError: true };
      }
    },
  );
}
