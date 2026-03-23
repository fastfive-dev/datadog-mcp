const RELATIVE_TIME_REGEX = /^(\d+)(m|h|d)$/;

const UNIT_TO_SECONDS: Record<string, number> = {
  m: 60,
  h: 3600,
  d: 86400,
};

export function parseRelativeTime(input: string): number {
  if (input === 'now') {
    return Math.floor(Date.now() / 1000);
  }

  const match = input.match(RELATIVE_TIME_REGEX);
  if (match) {
    const [, amount, unit] = match;
    const seconds = parseInt(amount, 10) * UNIT_TO_SECONDS[unit];
    return Math.floor(Date.now() / 1000) - seconds;
  }

  const asNumber = Number(input);
  if (!isNaN(asNumber) && asNumber > 0) {
    return Math.floor(asNumber);
  }

  throw new Error(`Invalid time format: "${input}". Use "now", relative (e.g. "1h", "30m", "7d"), or epoch seconds.`);
}
