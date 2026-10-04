/**
 * Pure, dependency-free cooldown math — deliberately its own module (not
 * part of discovery-run.ts, which imports Prisma) so a client component can
 * import it directly for display purposes without pulling server-only code
 * into the browser bundle. The server action that actually enforces this
 * (`refreshOpportunitiesAction`) imports the same constant/function from
 * here too, so the UI's displayed cooldown and the server's real one can
 * never drift apart.
 */

/**
 * Manual "Find New Opportunities" cooldown — prevents repeatedly triggering
 * an expensive discovery run. Deliberately a fixed product constant, NOT
 * `SaaSProject.discoveryIntervalHours` (which only gates the separate
 * automatic/cron path) — the two are independent on purpose, so a founder
 * changing their auto-discovery interval can never silently change how often
 * they can click the manual button, or vice versa.
 */
export const MANUAL_DISCOVERY_COOLDOWN_HOURS = 6;

/** When the manual "Find New Opportunities" button becomes usable again, or null if it's available now (never synced, or synced long enough ago). */
export function manualDiscoveryAvailableAt(lastSyncedAt: Date | null): Date | null {
  if (!lastSyncedAt) return null;
  const availableAt = new Date(
    lastSyncedAt.getTime() + MANUAL_DISCOVERY_COOLDOWN_HOURS * 60 * 60 * 1000,
  );
  return availableAt > new Date() ? availableAt : null;
}

/**
 * "5h 42m" / "42m" for a point in the FUTURE — deliberately separate from
 * `relativeTime` (opportunity-bits.tsx), which is written for the past only
 * and would misreport a future date (its negative diff reads as "just now"
 * regardless of how far ahead the date actually is).
 */
export function formatCooldown(availableAt: Date, now: Date = new Date()): string {
  const ms = Math.max(0, availableAt.getTime() - now.getTime());
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
