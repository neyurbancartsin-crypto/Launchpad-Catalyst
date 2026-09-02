/**
 * Fixture timestamps are expressed as "days ago" so demo data stays fresh
 * relative to whenever it is viewed — otherwise every recency score would
 * decay to zero and the demo would stop being representative.
 */
export function daysAgo(days: number, hours = 0): Date {
  const ms = (days * 24 + hours) * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}
