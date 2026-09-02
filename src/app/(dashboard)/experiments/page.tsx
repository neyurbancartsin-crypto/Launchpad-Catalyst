import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Experiments · Launchpad Catalyst" };

export default async function ExperimentsPage() {
  const project = await requireProject();
  const experiments = await prisma.experiment.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: { result: true },
  });

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Test one acquisition idea at a time, then find out whether it worked."
        action={
          <Link href="/experiments/new">
            <Button>New experiment</Button>
          </Link>
        }
      />

      {experiments.length === 0 ? (
        <EmptyState
          title="No experiments yet"
          description="An experiment is a hypothesis, a channel, a time window and a target. Running one stops you guessing about whether a channel works."
          action={
            <Link href="/experiments/new">
              <Button>Create your first experiment</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {experiments.map((experiment) => (
            <li key={experiment.id}>
              <Link
                href={`/experiments/${experiment.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-[#c4d3f7]"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      experiment.status === "COMPLETE"
                        ? "success"
                        : experiment.status === "RUNNING"
                          ? "brand"
                          : "neutral"
                    }
                  >
                    {experiment.status.charAt(0) +
                      experiment.status.slice(1).toLowerCase()}
                  </Badge>
                  {experiment.channel ? (
                    <Badge>{PLATFORM_LABELS[experiment.channel]}</Badge>
                  ) : null}
                  {experiment.result?.bottleneck ? (
                    <Badge tone="warning">
                      {experiment.result.bottleneck.toLowerCase()} bottleneck
                    </Badge>
                  ) : null}
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  {experiment.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {experiment.hypothesis}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {experiment.startDate.toLocaleDateString()} –{" "}
                  {experiment.endDate.toLocaleDateString()}
                  {experiment.targetConversations > 0
                    ? ` · target ${experiment.targetConversations} conversations`
                    : ""}
                  {experiment.result
                    ? ` · ${experiment.result.signups} signups`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
