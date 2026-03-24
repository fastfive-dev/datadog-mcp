import axios from 'axios';

export function formatToolError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'unknown';
    const data = error.response?.data;
    const errors = data?.errors;
    const detail = Array.isArray(errors)
      ? errors.join(', ')
      : typeof data?.error === 'string'
        ? data.error
        : typeof data?.detail === 'string'
          ? data.detail
          : error.message;
    return `Datadog API error (${status}): ${detail}`;
  }
  return error instanceof Error ? error.message : String(error);
}
