import { prisma } from "@/lib/db";
import { requireProjectWithIcp } from "@/lib/project";
import { updateIcpAction } from "@/actions/saas-project.actions";
import { IcpEditor } from "@/components/strategy/icp-editor";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import type { ProblemMapEntry } from "@/lib/ai/types";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { DemoBadge } from "@/components/ui/demo-badge";

export const metadata = { title: "Strategy · Launchpad Catalyst" };

export default async function StrategyPage() {
  const { project, icp } = await requireProjectWithIcp();
  const channels = await prisma.channel.findMany({
    where: { projectId: project.id },
    orderBy: { fitScore: "desc" },
  });

  const problemMap = (icp.problemMap as unknown as ProblemMapEntry[]) ?? [];

  return (
    <>
      <PageHeader
        title="Strategy"
        description={`How ${project.name} should approach acquisition: who to target, where they are, and what to do there.`}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Product understanding" />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-foreground">What it does</dt>
              <dd className="mt-0.5 text-muted">{icp.productSummary}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Core problem</dt>
              <dd className="mt-0.5 text-muted">{icp.coreProblem}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Value proposition</dt>
              <dd className="mt-0.5 text-muted">{icp.valueProposition}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Category</dt>
              <dd className="mt-0.5 text-muted">{icp.productCategory}</dd>
            </div>
          </dl>
        </Card>

        <IcpEditor
          action={updateIcpAction}
          editedByUser={icp.editedByUser}
          values={{
            primaryCustomer: icp.primaryCustomer,
            secondaryCustomer: icp.secondaryCustomer,
            companySize: icp.companySize,
            roles: icp.roles,
            industries: icp.industries,
            painPoints: icp.painPoints,
            buyingTriggers: icp.buyingTriggers,
            objections: icp.objections,
            searchTopics: icp.searchTopics,
            intentSignals: icp.intentSignals,
          }}
        />

        <Card>
          <CardHeader
            title="Problem map"
            description="The problem you solve, and the problems that sit next to it. People often describe the neighbours instead."
          />
          <div className="space-y-4">
            {problemMap.map((entry) => (
              <div key={entry.problem}>
                <p className="text-sm font-medium text-foreground">{entry.problem}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted">
                  {entry.relatedProblems.map((related) => (
                    <li key={related}>{related}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Search topics"
              description="What discovery searches for on your behalf."
            />
            <ul className="flex flex-wrap gap-1.5">
              {icp.searchTopics.map((topic) => (
                <li key={topic}>
                  <Badge tone="brand">{topic}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Intent signals"
              description="Phrases that suggest someone is actively looking for a solution."
            />
            <ul className="flex flex-wrap gap-1.5">
              {icp.intentSignals.map((signal) => (
                <li key={signal}>
                  <Badge>&ldquo;{signal}&rdquo;</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Recommended channels"
            description="Where to spend your acquisition time, and what to actually do there."
            action={<DemoBadge />}
          />
          <div className="space-y-5">
            {channels.map((channel) => (
              <article
                key={channel.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {PLATFORM_LABELS[channel.platform]}
                  </h3>
                  <Badge tone={channel.fitScore >= 8 ? "success" : channel.fitScore >= 6 ? "brand" : "neutral"}>
                    Fit {channel.fitScore}/10
                  </Badge>
                  <Badge
                    tone={
                      channel.priority === "High"
                        ? "success"
                        : channel.priority === "Medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {channel.priority} priority
                  </Badge>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <ChannelDetail label="Why it fits" value={channel.whyItFits} />
                  <ChannelDetail label="Who to find" value={channel.whoToFind} />
                  <ChannelDetail label="Topics to target" value={channel.topicsToTarget} />
                  <ChannelDetail label="Conversations to join" value={channel.conversationsToJoin} />
                  <ChannelDetail label="Action to take" value={channel.actionToTake} />
                </dl>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ChannelDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-muted">{value}</dd>
    </div>
  );
}
