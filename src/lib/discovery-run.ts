import type { ICP, SaaSProject } from "@prisma/client";
import { prisma } from "@/lib/db";
import { syncOpportunities, type SyncSummary } from "@/lib/discovery";
import { createNotificationsForNewOpportunities } from "@/lib/notifications";
import { generateFreshQueries } from "@/lib/search/generate-discovery-queries";
export { MANUAL_DISCOVERY_COOLDOWN_HOURS, manualDiscoveryAvailableAt } from "@/lib/discovery-cooldown";

/**
 * Shared entry point for every discovery trigger — onboarding's first sync,
 * a founder's manual "Find New Opportunities" click, and the background
 * cron — so there is exactly one place that runs `syncOpportunities`, claims
 * the per-project concurrency lock, and records the `DiscoveryRun`. None of
 * this calls AI: `syncOpportunities` itself is already AI-free for
 * discovery/scoring (see discovery.ts), and everything here is plain
 * Prisma reads/writes.
 */

/**
 * A lock older than this is treated as abandoned (e.g. the process that held
 * it crashed or was killed) rather than actually in progress, so a project
 * can never be stuck locked forever.
 */
const STALE_LOCK_MS = 10 * 60 * 1000;

const SYNC_STATUS_LABELS: Record<
  Exclude<SyncSummary["perPlatform"][number]["status"], "OK" | "EMPTY">,
  string
> = {
  RATE_LIMITED: "Rate limited",
  API_ERROR: "API error",
  DB_ERROR: "Database error",
};

/**
 * Turns per-platform sync failures into one founder-facing string, tagged by
 * category (rate limit vs. API vs. database) so it's not one indistinguishable
 * blob — still a single string, so no schema change is needed to show it.
 */
export function formatSyncFailures(perPlatform: SyncSummary["perPlatform"]): string | null {
  const failures = perPlatform.filter((p) => p.error);
  if (failures.length === 0) return null;

  return failures
    .map((f) => {
      const label =
        f.status === "OK" || f.status === "EMPTY" ? null : SYNC_STATUS_LABELS[f.status];
      return label ? `${f.platform} — ${label}: ${f.error}` : `${f.platform}: ${f.error}`;
    })
    .join(" | ");
}

/**
 * Atomically claims the discovery lock for one project: only succeeds if
 * nothing else currently holds it (or the existing lock is stale). Backed by
 * a single conditional `UPDATE`, which Postgres serialises per row — under
 * real concurrent calls, only one caller's `WHERE` still matches after the
 * other has committed, so at most one `claimDiscoveryLock` call returns true.
 */
export async function claimDiscoveryLock(projectId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const result = await prisma.saaSProject.updateMany({
    where: {
      id: projectId,
      OR: [{ discoveryStartedAt: null }, { discoveryStartedAt: { lt: staleBefore } }],
    },
    data: { discoveryStartedAt: new Date() },
  });
  return result.count === 1;
}

export async function releaseDiscoveryLock(projectId: string): Promise<void> {
  await prisma.saaSProject.updateMany({
    where: { id: projectId },
    data: { discoveryStartedAt: null },
  });
}

/**
 * Writes the project's `lastSyncError`/`lastSyncedAt` (and, for an automatic
 * run, `lastAutoDiscoveryAt`) plus one `DiscoveryRun` row — the simplest
 * persistence that supports "last searched" and a short history without a
 * full event-sourcing system.
 */
async function recordDiscoveryRun(
  projectId: string,
  runStartedAt: Date,
  summary: SyncSummary,
  isAuto: boolean,
  queriesUsed: string[],
): Promise<void> {
  const errorSummary = formatSyncFailures(summary.perPlatform);
  const now = new Date();
  await prisma.$transaction([
    prisma.saaSProject.update({
      where: { id: projectId },
      data: {
        lastSyncError: errorSummary,
        lastSyncedAt: now,
        ...(isAuto ? { lastAutoDiscoveryAt: now } : {}),
      },
    }),
    // `runAt` is pinned to when the sync started (not `now()` at insert
    // time) so the opportunity feed can mark a row "new" by comparing its
    // `discoveredAt` against this run's start.
    prisma.discoveryRun.create({
      data: {
        projectId,
        runAt: runStartedAt,
        newCount: summary.discovered,
        updatedCount: summary.updated,
        errorSummary,
        isAuto,
        // Read back by `generateFreshQueries` on the next cycle so query
        // generation can favor genuinely different angles over these.
        queriesUsed,
      },
    }),
  ]);
}

export type DiscoveryRunOutcome =
  | { ran: true; summary: SyncSummary }
  /** Another run (manual or automatic) already holds the lock for this project. */
  | { ran: false; reason: "locked" };

/**
 * Runs one discovery sync for a project under the concurrency lock, and
 * records the result. Used by onboarding, "Find New Opportunities", and the
 * cron alike — there is no second discovery implementation.
 */
export async function runDiscoverySync(
  project: SaaSProject,
  icp: ICP,
  options: { isAuto: boolean },
): Promise<DiscoveryRunOutcome> {
  const claimed = await claimDiscoveryLock(project.id);
  if (!claimed) {
    return { ran: false, reason: "locked" };
  }

  const runStartedAt = new Date();
  try {
    // One AI call for this cycle's search angles — reuses the ICP already
    // stored on this project rather than regenerating the business
    // understanding (see generateFreshQueries' own docs). Applies to every
    // caller alike (onboarding, manual refresh, cron) so repeated automatic
    // cycles get the same freshness as a manual one.
    const freshQueries = await generateFreshQueries(project, icp);
    const summary = await syncOpportunities(project, icp, { freshQueries });
    await recordDiscoveryRun(project.id, runStartedAt, summary, options.isAuto, freshQueries);
    // Only the automatic cron notifies — a founder who just clicked "Find
    // New Opportunities" (or is finishing onboarding) is already looking at
    // the results, so notifying them too would just be noise.
    if (options.isAuto) {
      await createNotificationsForNewOpportunities(
        project.userId,
        project.id,
        summary.newOpportunityIds,
      );
    }
    return { ran: true, summary };
  } finally {
    // Always released, even if syncOpportunities/recordDiscoveryRun throws —
    // a crashed run must not leave the project locked.
    await releaseDiscoveryLock(project.id);
  }
}
