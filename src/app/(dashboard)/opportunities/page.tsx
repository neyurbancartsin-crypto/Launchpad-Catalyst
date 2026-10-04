import Link from "next/link";
import type { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import {
  getLivePlatforms,
  PLATFORM_LABELS,
  SUPPORTED_PLATFORMS,
} from "@/lib/adapters/registry";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoBanner } from "@/components/ui/demo-badge";
import { DiscoveryPanel } from "@/components/opportunities/discovery-panel";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { DiscoveryProgress } from "@/components/opportunities/discovery-progress";

export const metadata = { title: "Opportunities · Launchpad Catalyst" };

/**
 * One primary "view" (what kind of opportunity to see) instead of a pile of
 * independent filters.
 *
 * Visibility fix: every discovered, non-dismissed opportunity must be
 * reachable somewhere, not just the ones that cleared the Recommended bar.
 * "All Opportunities" is the obvious, no-filter view (and the default — see
 * `parseView` — since most of what discovery finds doesn't score
 * HIGH/REVIEW, and landing on an often-empty "Recommended" page reads as
 * "nothing was found" even when plenty was). "Relevant" now covers both LOW
 * and DEPRIORITISE bands — both are still "relevant" under the EXISTING
 * four-tier scoring (DEPRIORITISE already carries the founder-facing label
 * "Low Relevance" in `OPPORTUNITY_TIER` below, it was just excluded from
 * this tab's filter before). This only widens which existing priorityBand
 * values a tab's `where` matches — no score, threshold, or recommendation
 * logic changes anywhere.
 */
const VIEWS = {
  all: { label: "All Opportunities", where: { status: { not: "IGNORED" } } },
  recommended: {
    label: "Recommended",
    where: { priorityBand: { in: ["HIGH", "REVIEW"] }, status: { not: "IGNORED" } },
  },
  relevant: {
    label: "Relevant",
    where: { priorityBand: { in: ["LOW", "DEPRIORITISE"] }, status: { not: "IGNORED" } },
  },
  high: {
    label: "High Opportunity",
    where: { priorityBand: "HIGH", status: { not: "IGNORED" } },
  },
  saved: { label: "Saved", where: { status: "SAVED" } },
  dismissed: { label: "Dismissed", where: { status: "IGNORED" } },
} as const satisfies Record<string, { label: string; where: Prisma.OpportunityWhereInput }>;

type ViewKey = keyof typeof VIEWS;

const SORTS = {
  score: "Highest opportunity",
  recent: "Newest",
  engagement: "Highest engagement",
} as const;

type SortKey = keyof typeof SORTS;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const project = await requireProject();
  const params = await searchParams;
  const livePlatforms = await getLivePlatforms();
  const anyLive = livePlatforms.length > 0;

  const platform = single(params.platform) as Platform | undefined;
  const view = parseView(single(params.view));
  const sort = parseSort(single(params.sort));
  const take = parseTake(single(params.take));

  // An explicit platform choice is always honoured, including a mock one —
  // a founder can still deliberately preview demo content for a platform
  // they haven't connected. Left at "All platforms", the default view shows
  // only genuinely live platforms once at least one is connected, so demo
  // fixtures never blend into what looks like real results; with nothing
  // connected yet, every platform stays in the existing demo experience.
  const explicitPlatform =
    platform && SUPPORTED_PLATFORMS.includes(platform) ? platform : undefined;
  const platformScope: Prisma.OpportunityWhereInput = explicitPlatform
    ? { platform: explicitPlatform }
    : anyLive
      ? { platform: { in: livePlatforms } }
      : {};

  const where: Prisma.OpportunityWhereInput = {
    projectId: project.id,
    ...platformScope,
    ...VIEWS[view].where,
  };

  const [opportunities, viewTotal, grandTotal, latestRun, recentRuns, lastAutoRun] =
    await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy:
          sort === "recent"
            ? { postedAt: "desc" }
            : sort === "engagement"
              ? [{ engagementScore: "desc" }, { opportunityScore: "desc" }]
              : [{ opportunityScore: "desc" }, { postedAt: "desc" }],
        take,
      }),
      // Scoped to the current view — drives "Showing X of Y" and whether a
      // "Load more" is offered. A fixed `take` alone would silently hide
      // anything past the cap with no way to reach it (verified against real
      // data: a project with 200+ discovered opportunities was losing results
      // past the old fixed take:100 with no way to see the rest).
      prisma.opportunity.count({ where }),
      // Unscoped by view — distinguishes "nothing discovered at all yet" from
      // "nothing matches this particular view" for the empty-state message below.
      prisma.opportunity.count({ where: { projectId: project.id, ...platformScope } }),
      prisma.discoveryRun.findFirst({
        where: { projectId: project.id },
        orderBy: { runAt: "desc" },
      }),
      prisma.discoveryRun.findMany({
        where: { projectId: project.id },
        orderBy: { runAt: "desc" },
        take: 4,
        select: { id: true, runAt: true, newCount: true, updatedCount: true },
      }),
      prisma.discoveryRun.findFirst({
        where: { projectId: project.id, isAuto: true },
        orderBy: { runAt: "desc" },
        select: { newCount: true },
      }),
    ]);

  const anyDemo = opportunities.some((o) => o.isDemoData);

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Conversations where someone may have the problem you solve, scored and ranked."
      />

      <DiscoveryPanel
        projectId={project.id}
        lastSyncedAt={project.lastSyncedAt}
        runs={recentRuns}
        autoDiscoveryEnabled={project.autoDiscoveryEnabled}
        discoveryIntervalHours={project.discoveryIntervalHours}
        lastAutoDiscoveryAt={project.lastAutoDiscoveryAt}
        lastAutoNewCount={lastAutoRun?.newCount ?? null}
      />

      {project.lastSyncError ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-danger-border bg-danger-soft px-4 py-3"
        >
          <p className="text-sm font-medium text-danger">
            Some platforms had a problem on the last run
          </p>
          <p className="mt-0.5 text-sm text-danger/90">{project.lastSyncError}</p>
        </div>
      ) : null}

      {anyDemo ? (
        <DemoBanner title={anyLive ? "Some results shown are demo data" : undefined}>
          {anyLive
            ? "You're viewing bundled demo conversations for a platform you haven't connected live. Connect it in Settings, or change the platform filter to see only your live results."
            : undefined}
        </DemoBanner>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(VIEWS) as [ViewKey, (typeof VIEWS)[ViewKey]][]).map(([key, v]) => (
            <Link
              key={key}
              href={`/opportunities?${buildQuery({ view: key, platform, sort })}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                view === key
                  ? "border-brand-border bg-brand-soft text-foreground"
                  : "border-border text-muted hover:bg-surface-muted"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>

        <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <input type="hidden" name="view" value={view} />
          <FilterSelect
            name="platform"
            label="Platform"
            value={platform ?? ""}
            options={[
              { value: "", label: "All platforms" },
              ...SUPPORTED_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
            ]}
          />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={sort}
            options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
          />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {platform ? (
            <Link
              href={`/opportunities?${buildQuery({ view, sort })}`}
              className="text-sm text-brand hover:underline"
            >
              Clear platform filter
            </Link>
          ) : null}
        </form>
      </Card>

      {opportunities.length === 0 ? (
        <EmptyState
          title={grandTotal === 0 ? "No opportunities yet" : "No new opportunities yet"}
          description={
            grandTotal === 0
              ? "Run discovery to find conversations that match your ideal customer profile."
              : view === "recommended"
                ? "Nothing has cleared the Recommended bar yet — check All Opportunities or Relevant to see everything discovery found."
                : "Nothing matches this view yet."
          }
          action={
            grandTotal === 0 ? (
              <DiscoveryProgress lastSyncedAt={project.lastSyncedAt} />
            ) : (
              <Link href="/opportunities?view=all">
                <Button variant="secondary">See All Opportunities</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Showing {opportunities.length} of {viewTotal}
          </p>
          <ul className="space-y-3">
            {opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                isNew={Boolean(latestRun && opportunity.discoveredAt >= latestRun.runAt)}
              />
            ))}
          </ul>
          {opportunities.length < viewTotal ? (
            <div className="mt-4 flex justify-center">
              <Link href={`/opportunities?${buildQuery({ view, platform, sort, take: String(take + TAKE_STEP) })}`}>
                <Button variant="secondary">
                  Load more ({viewTotal - opportunities.length} remaining)
                </Button>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Visibility fix: land on the view that always shows everything discovery
// found, not the one most likely to be empty — most discovered conversations
// don't clear the Recommended bar (that's expected, not a bug), so defaulting
// there made a successful discovery run look like it found nothing.
function parseView(value: string | undefined): ViewKey {
  return value && value in VIEWS ? (value as ViewKey) : "all";
}

function parseSort(value: string | undefined): SortKey {
  return value && value in SORTS ? (value as SortKey) : "score";
}

const TAKE_DEFAULT = 50;
const TAKE_STEP = 50;
const TAKE_MAX = 500;

/** Bounded so a crafted URL can't force an unbounded query. */
function parseTake(value: string | undefined): number {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return TAKE_DEFAULT;
  return Math.min(Math.round(n), TAKE_MAX);
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
