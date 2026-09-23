import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectWithIcp } from "@/lib/project";
import {
  analyzeLandingPageAction,
  deleteReportAction,
  generateWeeklyReportAction,
} from "@/actions/reports.actions";
import { LandingPageAuditForm } from "@/components/reports/landing-page-audit";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import type { FunnelCounts, LandingPageAnalysis } from "@/lib/ai/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui";

export const metadata = { title: "Reports · Launchpad Catalyst" };

interface ReportPayload {
  activitySummary: string;
  bestChannel: Platform | null;
  bestTopic: string | null;
  bestConversationType: string | null;
  bottleneckExplanation: string;
  recommendation: string;
  nextActions: string[];
  funnel: FunnelCounts;
  responsesPosted: number;
  conversationsStarted: number;
}

const SCORE_LABELS: Record<string, string> = {
  icpClarity: "ICP clarity",
  problemClarity: "Problem clarity",
  valueProposition: "Value proposition",
  cta: "Call to action",
  messaging: "Messaging",
  socialProof: "Social proof",
  pricingClarity: "Pricing clarity",
  differentiation: "Differentiation",
};

export default async function ReportsPage() {
  const { project } = await requireProjectWithIcp();

  const [reports, audits] = await Promise.all([
    prisma.growthReport.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.landingPageAudit.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const latest = reports[0];
  const payload = latest ? (latest.payload as unknown as ReportPayload) : null;

  return (
    <>
      <PageHeader
        title="Reports"
        description="What your acquisition activity produced this week, and where the funnel is actually breaking."
        action={
          <form action={generateWeeklyReportAction}>
            <Button type="submit">Generate weekly report</Button>
          </form>
        }
      />

      {!latest || !payload ? (
        <EmptyState
          title="No reports yet"
          description="Generate a report once you have logged some activity. It reads the last seven days of conversations and results."
          action={
            <form action={generateWeeklyReportAction}>
              <Button type="submit">Generate weekly report</Button>
            </form>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="This week"
              description={`${latest.periodStart.toLocaleDateString()} – ${latest.periodEnd.toLocaleDateString()}`}
              action={
                latest.bottleneck ? (
                  <Badge tone="warning">
                    {latest.bottleneck.toLowerCase()} bottleneck
                  </Badge>
                ) : null
              }
            />
            <p className="text-sm text-muted">{payload.activitySummary}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Opportunities" value={payload.funnel.opportunities} />
              <StatTile label="Engagements" value={payload.funnel.engagements} />
              <StatTile label="Visits" value={payload.funnel.websiteVisits} />
              <StatTile label="Signups" value={payload.funnel.signups} />
              <StatTile label="Activated" value={payload.funnel.activations} />
              <StatTile label="Paid" value={payload.funnel.paid} />
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader title="Best channel" />
              <p className="text-sm text-foreground">
                {payload.bestChannel
                  ? PLATFORM_LABELS[payload.bestChannel]
                  : "Not enough activity yet"}
              </p>
            </Card>
            <Card>
              <CardHeader title="Best topic" />
              <p className="text-sm text-foreground">
                {payload.bestTopic ?? "Not enough activity yet"}
              </p>
            </Card>
            <Card>
              <CardHeader title="Best conversation type" />
              <p className="text-sm text-foreground">
                {payload.bestConversationType ?? "Not enough activity yet"}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Bottleneck diagnosis"
              description="Where the funnel is losing people — which is not always marketing."
            />
            <p className="text-sm text-muted">{payload.bottleneckExplanation}</p>
            <h3 className="mt-4 text-sm font-medium text-foreground">
              Recommendation
            </h3>
            <p className="mt-0.5 text-sm text-muted">{payload.recommendation}</p>
            <h3 className="mt-4 text-sm font-medium text-foreground">
              Next actions
            </h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {payload.nextActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          {reports.length > 1 ? (
            <Card>
              <CardHeader title="Earlier reports" />
              <ul className="space-y-2 text-sm">
                {reports.slice(1).map((report) => (
                  <li
                    key={report.id}
                    className="flex items-center justify-between gap-3 border-t border-border pt-2"
                  >
                    <span className="text-muted">
                      {report.periodStart.toLocaleDateString()} –{" "}
                      {report.periodEnd.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-2">
                      {report.bottleneck ? (
                        <Badge tone="warning">
                          {report.bottleneck.toLowerCase()}
                        </Badge>
                      ) : null}
                      <form action={deleteReportAction}>
                        <input type="hidden" name="reportId" value={report.id} />
                        <Button variant="ghost" type="submit">
                          Remove
                        </Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Landing page analyser"
          description="If people visit but do not sign up, the page is usually the problem, not the channel."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <LandingPageAuditForm
            defaultUrl={project.website ?? ""}
            action={analyzeLandingPageAction}
          />

          {audits.length > 0 ? (
            <div>
              {(() => {
                const audit = audits[0];
                const result = audit.payload as unknown as LandingPageAnalysis;
                return (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {audit.url}
                      </p>
                      {result.isDemoData ? (
                        <Badge tone="demo">Illustrative</Badge>
                      ) : null}
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {Object.entries(result.scores).map(([key, value]) => (
                        <li key={key} className="flex items-center gap-2">
                          <span className="w-36 shrink-0 text-muted">
                            {SCORE_LABELS[key] ?? key}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              className="block h-full rounded-full bg-brand"
                              style={{ width: `${value}%` }}
                            />
                          </span>
                          <span className="w-8 text-right text-xs tabular-nums text-muted">
                            {value}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <h3 className="mt-4 text-sm font-medium text-foreground">
                      Biggest issue
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">{result.biggestIssue}</p>
                    <h3 className="mt-3 text-sm font-medium text-foreground">
                      Recommendation
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">
                      {result.recommendation}
                    </p>
                    {result.isDemoData ? (
                      <p className="mt-3 rounded-lg border border-demo-border bg-demo-soft px-3 py-2 text-xs text-demo">
                        This audit is illustrative. The demo engine does not fetch
                        your page — connect a real AI provider for a genuine review.
                      </p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Run an analysis to see how clearly your page communicates.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
