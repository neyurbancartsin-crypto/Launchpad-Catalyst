import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveProject } from "@/lib/project";
import { getStageCounts } from "@/lib/funnel";
import { getLivePlatforms, PLATFORM_LABELS } from "@/lib/adapters/registry";
import { Prisma } from "@prisma/client";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { DemoBadge, DemoBanner } from "@/components/ui/demo-badge";
import { FunnelView } from "@/components/tracking/funnel-view";
import {
  PlatformBadge,
  relativeTime,
  RiskBadge,
  ScoreBadge,
} from "@/components/opportunities/opportunity-bits";

export const metadata = { title: "Dashboard · Launchpad Catalyst" };

export default async function DashboardPage() {
  const project = await getActiveProject();
  if (!project || !project.onboardingComplete) redirect("/onboarding");

  const livePlatforms = await getLivePlatforms();
  const anyLive = livePlatforms.length > 0;
  // Once at least one platform is genuinely connected, bundled demo/mock
  // opportunities are left out of the dashboard entirely — the same rule
  // discovery itself now follows. With nothing connected yet, every
  // platform stays in the existing demo experience, unchanged.
  const platformScope: Prisma.OpportunityWhereInput = anyLive
    ? { platform: { in: livePlatforms } }
    : {};

  const [
    missions,
    stages,
    opportunityCount,
    activeExperiment,
    latestReport,
    postedCount,
    newCount,
    savedCount,
    analyzedCount,
  ] = await Promise.all([
    // Recommended: the highest-value conversations not yet acted on.
    prisma.opportunity.findMany({
      where: {
        projectId: project.id,
        ...platformScope,
        status: { in: ["NEW", "REVIEWED"] },
        priorityBand: { in: ["HIGH", "REVIEW"] },
        recommendedAction: { not: "Do not engage" },
      },
      orderBy: [{ opportunityScore: "desc" }, { postedAt: "desc" }],
      take: 4,
    }),
    getStageCounts(project.id),
    prisma.opportunity.count({ where: { projectId: project.id, ...platformScope } }),
    prisma.experiment.findFirst({
      where: { projectId: project.id, status: { in: ["RUNNING", "PLANNED"] } },
      orderBy: { createdAt: "desc" },
      include: { result: true },
    }),
    prisma.growthReport.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.response.count({
      where: { opportunity: { projectId: project.id }, status: "POSTED" },
    }),
    prisma.opportunity.count({
      where: { projectId: project.id, ...platformScope, status: "NEW" },
    }),
    prisma.opportunity.count({
      where: { projectId: project.id, ...platformScope, status: "SAVED" },
    }),
    prisma.conversation.count({
      where: {
        opportunity: { projectId: project.id },
        analysis: { not: Prisma.DbNull },
      },
    }),
  ]);

  const funnelStages = [
    { stage: "OPPORTUNITY" as const, count: opportunityCount },
    ...stages.filter((s) => s.stage !== "OPPORTUNITY"),
  ];

  const reportPayload = latestReport?.payload as unknown as
    | { recommendation: string; activitySummary: string }
    | undefined;

  return (
    <>
      <PageHeader
        title={`What should you do today to get customers?`}
        description={`${project.name} · ${opportunityCount} opportunities discovered`}
      />

      {!anyLive ? <DemoBanner /> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="New opportunities" value={newCount} />
        <StatTile label="Saved" value={savedCount} />
        <StatTile label="Analyzed" value={analyzedCount} />
        <StatTile label="Posted" value={postedCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Your Opportunities"
              description="High-priority opportunities needing attention."
              action={
                <Link href="/opportunities">
                  <Button variant="secondary">View Recommended Opportunities</Button>
                </Link>
              }
            />
            {missions.length === 0 ? (
              <EmptyState
                title="Nothing needs attention right now"
                description="Every high-priority opportunity is either handled or dismissed. Find new opportunities to look for more conversations."
                action={
                  <Link href="/opportunities">
                    <Button>View Recommended Opportunities</Button>
                  </Link>
                }
              />
            ) : (
              <ol className="space-y-3">
                {missions.map((mission, index) => (
                  <li key={mission.id}>
                    <Link
                      href={`/opportunities/${mission.id}`}
                      className="flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-[#c4d3f7] hover:bg-brand-soft/30"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <ScoreBadge
                            score={mission.opportunityScore}
                            band={mission.priorityBand}
                          />
                          <PlatformBadge platform={mission.platform} />
                          <Badge>{mission.communityName}</Badge>
                          <RiskBadge risk={mission.promotionRisk} />
                          {mission.isDemoData ? <DemoBadge /> : null}
                        </span>
                        <span className="block text-sm font-medium text-foreground">
                          {mission.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {mission.recommendedAction} ·{" "}
                          {relativeTime(mission.postedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Acquisition funnel"
              action={
                <Link href="/tracking">
                  <Button variant="secondary">Log a result</Button>
                </Link>
              }
            />
            <FunnelView stages={funnelStages} />
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Weekly insight" />
            {reportPayload ? (
              <>
                <p className="text-sm text-muted">{reportPayload.recommendation}</p>
                {latestReport?.bottleneck ? (
                  <p className="mt-3">
                    <Badge tone="warning">
                      {latestReport.bottleneck.toLowerCase()} bottleneck
                    </Badge>
                  </p>
                ) : null}
                <Link href="/reports" className="mt-3 inline-block text-sm text-brand hover:underline">
                  Full report →
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Generate a weekly report once you have logged some activity.
                </p>
                <Link href="/reports" className="mt-3 inline-block text-sm text-brand hover:underline">
                  Go to reports →
                </Link>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Active experiment" />
            {activeExperiment ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {activeExperiment.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {activeExperiment.hypothesis}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="brand">
                    {activeExperiment.status.toLowerCase()}
                  </Badge>
                  {activeExperiment.channel ? (
                    <Badge>{PLATFORM_LABELS[activeExperiment.channel]}</Badge>
                  ) : null}
                </p>
                <Link
                  href={`/experiments/${activeExperiment.id}`}
                  className="mt-3 inline-block text-sm text-brand hover:underline"
                >
                  Open experiment →
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  No experiment running. An experiment turns guessing about a
                  channel into a measurable answer.
                </p>
                <Link
                  href="/experiments/new"
                  className="mt-3 inline-block text-sm text-brand hover:underline"
                >
                  Create one →
                </Link>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Strategy" />
            <p className="text-sm text-muted">
              Your ICP drives what gets discovered. Keep it accurate.
            </p>
            <Link href="/strategy" className="mt-3 inline-block text-sm text-brand hover:underline">
              Review strategy →
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
