import Link from "next/link";
import type { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import { refreshOpportunitiesAction } from "@/actions/saas-project.actions";
import {
  getLivePlatforms,
  PLATFORM_LABELS,
  SUPPORTED_PLATFORMS,
} from "@/lib/adapters/registry";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoBanner } from "@/components/ui/demo-badge";
import { DiscoveryPanel } from "@/components/opportunities/discovery-panel";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { FindOpportunitiesButton } from "@/components/opportunities/find-opportunities-button";

export const metadata = { title: "Opportunities · Launchpad Catalyst" };

/**
 * Phase 7: one primary "view" (what kind of opportunity to see) instead of a
 * pile of independent filters — Recommended is the default, everything else
 * is one click away. Platform and sort stay as light secondary controls.
 */
const VIEWS = {
  recommended: {
    label: "Recommended",
    where: { priorityBand: { in: ["HIGH", "REVIEW"] }, status: { not: "IGNORED" } },
  },
  high: {
    label: "High Opportunity",
    where: { priorityBand: "HIGH", status: { not: "IGNORED" } },
  },
  relevant: {
    label: "Relevant",
    where: { priorityBand: "LOW", status: { not: "IGNORED" } },
  },
  saved: { label: "Saved", where: { status: "SAVED" } },
  dismissed: { label: "Dismissed", where: { status: "IGNORED" } },
  all: { label: "All", where: {} },
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

  const [opportunities, total, latestRun, recentRuns, lastAutoRun] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy:
        sort === "recent"
          ? { postedAt: "desc" }
          : sort === "engagement"
            ? [{ engagementScore: "desc" }, { opportunityScore: "desc" }]
            : [{ opportunityScore: "desc" }, { postedAt: "desc" }],
      take: 100,
    }),
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
          className="mb-6 rounded-xl border border-[#f0c4c1] bg-danger-soft px-4 py-3"
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
                  ? "border-[#c4d3f7] bg-brand-soft text-brand"
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
          title={total === 0 ? "No opportunities yet" : "No new opportunities yet"}
          description={
            total === 0
              ? "Run discovery to find conversations that match your ideal customer profile."
              : view === "recommended"
                ? "We couldn't find new conversations matching your product right now. Try again later, or check other views below."
                : "Nothing matches this view yet."
          }
          action={
            total === 0 ? (
              <form action={refreshOpportunitiesAction}>
                <FindOpportunitiesButton />
              </form>
            ) : (
              <Link href="/opportunities">
                <Button variant="secondary">Back to Recommended</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Showing {opportunities.length} of {total}
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

function parseView(value: string | undefined): ViewKey {
  return value && value in VIEWS ? (value as ViewKey) : "recommended";
}

function parseSort(value: string | undefined): SortKey {
  return value && value in SORTS ? (value as SortKey) : "score";
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
