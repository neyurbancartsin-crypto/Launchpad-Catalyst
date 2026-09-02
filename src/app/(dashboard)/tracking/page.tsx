import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import {
  deleteEngagementAction,
  logEngagementAction,
} from "@/actions/engagement.actions";
import { getStageCounts, STAGE_LABELS } from "@/lib/funnel";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { FunnelView } from "@/components/tracking/funnel-view";
import { LogEngagementForm } from "@/components/tracking/log-engagement-form";

export const metadata = { title: "Tracking · Launchpad Catalyst" };

export default async function TrackingPage() {
  const project = await requireProject();

  const [stages, opportunities, recent, opportunityCount] = await Promise.all([
    getStageCounts(project.id),
    prisma.opportunity.findMany({
      where: { projectId: project.id },
      orderBy: { opportunityScore: "desc" },
      select: { id: true, title: true },
      take: 50,
    }),
    prisma.engagement.findMany({
      where: { projectId: project.id },
      orderBy: { loggedAt: "desc" },
      take: 20,
      include: { opportunity: { select: { id: true, title: true } } },
    }),
    prisma.opportunity.count({ where: { projectId: project.id } }),
  ]);

  const withOpportunityStage = [
    { stage: "OPPORTUNITY" as const, count: opportunityCount },
    ...stages.filter((s) => s.stage !== "OPPORTUNITY"),
  ];

  return (
    <>
      <PageHeader
        title="Tracking"
        description="Record what your conversations actually produced. Nothing here is inferred — platforms do not report signups back to you."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Acquisition funnel"
            description="Where people drop out between a conversation and a paying customer."
          />
          <FunnelView stages={withOpportunityStage} />
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Opportunities are counted automatically from discovery. Every stage
            below it is recorded by you, so use a tracked link or UTM parameter
            on anything you share to make attribution possible.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Log a result"
            description="Something happened after a conversation? Record it here."
          />
          <LogEngagementForm
            opportunities={opportunities}
            action={logEngagementAction}
          />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" />
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Once you post a response and someone visits your site or signs up, record it here so the growth analysis has something to work with."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted uppercase">
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Platform</th>
                  <th className="pb-2 font-medium">Conversation</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {recent.map((engagement) => (
                  <tr key={engagement.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap text-muted">
                      {engagement.loggedAt.toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Badge tone="brand">{STAGE_LABELS[engagement.stage]}</Badge>
                    </td>
                    <td className="py-2 text-muted">
                      {PLATFORM_LABELS[engagement.platform]}
                    </td>
                    <td className="max-w-xs truncate py-2 text-muted">
                      {engagement.opportunity?.title ?? "—"}
                      {engagement.notes ? (
                        <span className="block text-xs">{engagement.notes}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {engagement.count}
                    </td>
                    <td className="py-2 text-right">
                      <form action={deleteEngagementAction}>
                        <input
                          type="hidden"
                          name="engagementId"
                          value={engagement.id}
                        />
                        <Button variant="ghost" type="submit">
                          Remove
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
