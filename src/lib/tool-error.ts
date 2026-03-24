import axios from 'axios';

export function formatToolError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'unknown';
    const errors = error.response?.data?.errors;
    const detail = Array.isArray(errors) ? errors.join(', ') : error.message;
    return `Datadog API error (${status}): ${detail}`;
  }
  return error instanceof Error ? error.message : String(error);
}
