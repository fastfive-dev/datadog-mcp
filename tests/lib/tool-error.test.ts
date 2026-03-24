import { describe, it, expect } from 'vitest';
import axios, { AxiosError } from 'axios';
import { formatToolError } from '../../src/lib/tool-error';

function makeAxiosError(status: number, data: any): AxiosError {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: 'Bad Request',
    headers: {},
    config: {} as any,
  });
  return error;
}

describe('formatToolError', () => {
  it('formats errors array from Datadog v1 API', () => {
    const err = makeAxiosError(400, { errors: ['Invalid query', 'Missing field'] });
    expect(formatToolError(err)).toBe('Datadog API error (400): Invalid query, Missing field');
  });

  it('formats error string from Datadog API', () => {
    const err = makeAxiosError(403, { error: 'Forbidden' });
    expect(formatToolError(err)).toBe('Datadog API error (403): Forbidden');
  });

  it('formats detail string from Datadog v2 API', () => {
    const err = makeAxiosError(404, { detail: 'Incident not found' });
    expect(formatToolError(err)).toBe('Datadog API error (404): Incident not found');
  });

  it('falls back to error.message when no structured error', () => {
    const err = makeAxiosError(500, {});
    expect(formatToolError(err)).toBe('Datadog API error (500): Request failed');
  });

  it('handles missing response (network error)', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    // axios.isAxiosError returns true for AxiosError instances
    expect(formatToolError(err)).toBe('Datadog API error (unknown): Network Error');
  });

  it('handles non-axios Error', () => {
    expect(formatToolError(new Error('something broke'))).toBe('something broke');
  });

  it('handles non-Error values', () => {
    expect(formatToolError('string error')).toBe('string error');
    expect(formatToolError(42)).toBe('42');
  });

  it('prefers errors array over error/detail', () => {
    const err = makeAxiosError(400, { errors: ['Primary'], error: 'Secondary', detail: 'Tertiary' });
    expect(formatToolError(err)).toBe('Datadog API error (400): Primary');
  });

  it('prefers error string over detail', () => {
    const err = makeAxiosError(400, { error: 'Primary', detail: 'Secondary' });
    expect(formatToolError(err)).toBe('Datadog API error (400): Primary');
  });
});
