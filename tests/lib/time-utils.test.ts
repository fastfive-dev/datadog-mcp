import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRelativeTime } from '../../src/lib/time-utils';

describe('parseRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses "now" to current epoch seconds', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(parseRelativeTime('now')).toBe(now);
  });

  it('parses "30m" to 30 minutes ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 30 * 60;
    expect(parseRelativeTime('30m')).toBe(expected);
  });

  it('parses "1h" to 1 hour ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 3600;
    expect(parseRelativeTime('1h')).toBe(expected);
  });

  it('parses "1d" to 1 day ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 86400;
    expect(parseRelativeTime('1d')).toBe(expected);
  });

  it('parses "7d" to 7 days ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 7 * 86400;
    expect(parseRelativeTime('7d')).toBe(expected);
  });

  it('parses "2w" to 2 weeks ago', () => {
    const expected = Math.floor(Date.now() / 1000) - 2 * 604800;
    expect(parseRelativeTime('2w')).toBe(expected);
  });

  it('passes through epoch seconds as-is', () => {
    expect(parseRelativeTime('1711180800')).toBe(1711180800);
  });

  it('throws on invalid format', () => {
    expect(() => parseRelativeTime('abc')).toThrow('Invalid time format');
  });
});
