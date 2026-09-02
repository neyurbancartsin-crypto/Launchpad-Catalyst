import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import {
  analyzeExperimentAction,
  saveExperimentResultAction,
} from "@/actions/experiments.actions";
import { ExperimentResultForm } from "@/components/experiments/experiment-forms";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import { Badge, Button, Card, CardHeader, PageHeader, StatTile } from "@/components/ui";

interface StoredAnalysis {
  whatHappened: string;
  interpretation: string;
  nextExperiment: string;
}

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject();

  const experiment = await prisma.experiment.findFirst({
    where: { id, projectId: project.id },
    include: { result: true },
  });
  if (!experiment) notFound();

  const result = experiment.result;
  const analysis = (result?.aiAnalysis as unknown as StoredAnalysis) ?? null;
  const hitTarget =
    experiment.targetConversations > 0 &&
    (result?.conversations ?? 0) >= experiment.targetConversations;

  return (
    <>
      <div className="mb-4">
        <Link href="/experiments" className="text-sm text-brand hover:underline">
          ← All experiments
        </Link>
      </div>

      <PageHeader title={experiment.name} description={experiment.hypothesis} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge
          tone={
            experiment.status === "COMPLETE"
              ? "success"
              : experiment.status === "RUNNING"
                ? "brand"
                : "neutral"
          }
        >
          {experiment.status.charAt(0) + experiment.status.slice(1).toLowerCase()}
        </Badge>
        {experiment.channel ? (
          <Badge>{PLATFORM_LABELS[experiment.channel]}</Badge>
        ) : (
          <Badge>All channels</Badge>
        )}
        <Badge>
          {experiment.startDate.toLocaleDateString()} –{" "}
          {experiment.endDate.toLocaleDateString()}
        </Badge>
        {experiment.targetConversations > 0 ? (
          <Badge tone={hitTarget ? "success" : "warning"}>
            Target {experiment.targetConversations} conversations
            {result ? (hitTarget ? " · met" : " · not met") : ""}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Action" />
          <p className="text-sm text-muted">{experiment.action}</p>
        </Card>

        {result ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Conversations" value={result.conversations} />
            <StatTile label="Website visits" value={result.websiteVisits} />
            <StatTile label="Signups" value={result.signups} />
            <StatTile label="Activated" value={result.activatedUsers} />
            <StatTile label="Paid" value={result.paidUsers} />
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Results"
            description="Record what the experiment produced, then run the analysis."
          />
          <ExperimentResultForm
            experimentId={experiment.id}
            initial={result}
            action={saveExperimentResultAction}
          />
        </Card>

        <Card>
          <CardHeader
            title="Growth analysis"
            description={
              result
                ? "What the numbers suggest, and what to test next."
                : "Save your results first, then run the analysis."
            }
            action={
              result ? (
                <form action={analyzeExperimentAction}>
                  <input type="hidden" name="experimentId" value={experiment.id} />
                  <Button type="submit" variant="secondary">
                    {analysis ? "Re-run analysis" : "Run analysis"}
                  </Button>
                </form>
              ) : null
            }
          />

          {analysis ? (
            <div className="space-y-4 text-sm">
              {result?.bottleneck ? (
                <Badge tone="warning">
                  Likely bottleneck: {result.bottleneck.toLowerCase()}
                </Badge>
              ) : null}
              <div>
                <h3 className="font-medium text-foreground">What happened</h3>
                <p className="mt-0.5 text-muted">{analysis.whatHappened}</p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">Interpretation</h3>
                <p className="mt-0.5 text-muted">{analysis.interpretation}</p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">Next experiment</h3>
                <p className="mt-0.5 text-muted">{analysis.nextExperiment}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              No analysis yet.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
