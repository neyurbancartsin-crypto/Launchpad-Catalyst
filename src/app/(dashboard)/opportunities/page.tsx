import Link from "next/link";
import type { OpportunityStatus, Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import { refreshOpportunitiesAction } from "@/actions/saas-project.actions";
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoBadge, DemoBanner } from "@/components/ui/demo-badge";
import {
  PlatformBadge,
  relativeTime,
  RiskBadge,
  ScoreBadge,
} from "@/components/opportunities/opportunity-bits";

export const metadata = { title: "Opportunities · Launchpad Catalyst" };

const STATUSES: OpportunityStatus[] = ["NEW", "REVIEWED", "RESPONDED", "IGNORED"];
const SORTS = { score: "Highest score", recent: "Most recent" } as const;

type SortKey = keyof typeof SORTS;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const project = await requireProject();
  const params = await searchParams;

  const platform = single(params.platform) as Platform | undefined;
  const status = single(params.status) as OpportunityStatus | undefined;
  const minScore = Number(single(params.minScore) ?? "0") || 0;
  const sort = (single(params.sort) as SortKey) ?? "score";

  const where: Prisma.OpportunityWhereInput = {
    projectId: project.id,
    ...(platform && SUPPORTED_PLATFORMS.includes(platform) ? { platform } : {}),
    ...(status && STATUSES.includes(status) ? { status } : {}),
    ...(minScore > 0 ? { opportunityScore: { gte: minScore } } : {}),
  };

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy:
        sort === "recent"
          ? { postedAt: "desc" }
          : [{ opportunityScore: "desc" }, { postedAt: "desc" }],
      take: 100,
    }),
    prisma.opportunity.count({ where: { projectId: project.id } }),
  ]);

  const anyDemo = opportunities.some((o) => o.isDemoData);

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Conversations where someone may have the problem you solve, scored and ranked."
        action={
          <form action={refreshOpportunitiesAction}>
            <Button variant="secondary" type="submit">
              Refresh opportunities
            </Button>
          </form>
        }
      />

      {project.lastSyncError ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-[#f0c4c1] bg-danger-soft px-4 py-3"
        >
          <p className="text-sm font-medium text-danger">
            Some platforms could not be reached on the last run
          </p>
          <p className="mt-0.5 text-sm text-danger/90">{project.lastSyncError}</p>
        </div>
      ) : null}

      {anyDemo ? <DemoBanner /> : null}

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3">
          <FilterSelect
            name="platform"
            label="Platform"
            value={platform ?? ""}
            options={[
              { value: "", label: "All platforms" },
              ...SUPPORTED_PLATFORMS.map((p) => ({
                value: p,
                label: PLATFORM_LABELS[p],
              })),
            ]}
          />
          <FilterSelect
            name="status"
            label="Status"
            value={status ?? ""}
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: titleCase(s) })),
            ]}
          />
          <FilterSelect
            name="minScore"
            label="Minimum score"
            value={String(minScore || "")}
            options={[
              { value: "", label: "Any score" },
              { value: "80", label: "80+ high priority" },
              { value: "60", label: "60+ worth reviewing" },
              { value: "40", label: "40+ low priority" },
            ]}
          />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={sort}
            options={Object.entries(SORTS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {(platform || status || minScore) ? (
            <Link href="/opportunities" className="text-sm text-brand hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      {opportunities.length === 0 ? (
        <EmptyState
          title={total === 0 ? "No opportunities yet" : "Nothing matches these filters"}
          description={
            total === 0
              ? "Run discovery to find conversations that match your ideal customer profile."
              : "Try widening the score threshold or clearing the platform filter."
          }
          action={
            total === 0 ? (
              <form action={refreshOpportunitiesAction}>
                <Button type="submit">Find opportunities</Button>
              </form>
            ) : (
              <Link href="/opportunities">
                <Button variant="secondary">Clear filters</Button>
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
              <li key={opportunity.id}>
                <Link
                  href={`/opportunities/${opportunity.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-[#c4d3f7] hover:bg-brand-soft/30"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ScoreBadge
                      score={opportunity.opportunityScore}
                      band={opportunity.priorityBand}
                    />
                    <PlatformBadge platform={opportunity.platform} />
                    <Badge>{opportunity.communityName}</Badge>
                    <RiskBadge risk={opportunity.promotionRisk} />
                    {opportunity.status !== "NEW" ? (
                      <Badge tone="brand">{titleCase(opportunity.status)}</Badge>
                    ) : null}
                    {opportunity.isDemoData ? <DemoBadge /> : null}
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {opportunity.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {opportunity.content}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {opportunity.author} · {relativeTime(opportunity.postedAt)} ·{" "}
                    {opportunity.commentCount} comments ·{" "}
                    <span className="font-medium text-foreground">
                      {opportunity.recommendedAction}
                    </span>
                  </p>
                </Link>
              </li>
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

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
