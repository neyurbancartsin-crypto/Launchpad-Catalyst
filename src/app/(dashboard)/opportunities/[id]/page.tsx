import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import {
  generateResponseAction,
  markResponsePostedAction,
  saveResponseAction,
  setOpportunityStatusAction,
} from "@/actions/responses.actions";
import type { CommentAnalysis } from "@/lib/ai/types";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { DemoBadge } from "@/components/ui/demo-badge";
import {
  BAND_LABELS,
  PlatformBadge,
  relativeTime,
  RiskBadge,
  ScoreBadge,
} from "@/components/opportunities/opportunity-bits";
import {
  ConversationThread,
  type StoredComment,
} from "@/components/opportunities/conversation-thread";
import { ScoreBreakdown } from "@/components/opportunities/score-breakdown";
import { ResponseCopilot } from "@/components/opportunities/response-copilot";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject();

  const opportunity = await prisma.opportunity.findFirst({
    where: { id, projectId: project.id },
    include: {
      conversation: true,
      responses: { orderBy: { createdAt: "desc" } },
      community: true,
    },
  });

  if (!opportunity) notFound();

  const comments =
    (opportunity.conversation?.comments as unknown as StoredComment[]) ?? [];
  const analysis =
    (opportunity.conversation?.analysis as unknown as CommentAnalysis[]) ?? [];

  const worthResponding = analysis.filter((a) => a.worthResponding).length;

  return (
    <>
      <div className="mb-4">
        <Link href="/opportunities" className="text-sm text-brand hover:underline">
          ← All opportunities
        </Link>
      </div>

      <PageHeader
        title={opportunity.title}
        description={`${opportunity.author} in ${opportunity.communityName} · ${relativeTime(opportunity.postedAt)}`}
        action={
          <a
            href={opportunity.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary">Open original ↗</Button>
          </a>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ScoreBadge
          score={opportunity.opportunityScore}
          band={opportunity.priorityBand}
        />
        <Badge tone={opportunity.priorityBand === "HIGH" ? "success" : "neutral"}>
          {BAND_LABELS[opportunity.priorityBand]}
        </Badge>
        <PlatformBadge platform={opportunity.platform} />
        <RiskBadge risk={opportunity.promotionRisk} />
        <Badge tone="brand">{opportunity.status.toLowerCase()}</Badge>
        {opportunity.isDemoData ? <DemoBadge /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Original post" />
            <p className="text-sm whitespace-pre-line text-foreground">
              {opportunity.content}
            </p>
            <p className="mt-3 text-xs text-muted">
              {opportunity.upvotes} upvotes · {opportunity.commentCount} comments
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Conversation"
              description={
                comments.length === 0
                  ? "No comments were retrieved for this post."
                  : `${comments.length} comments retrieved. ${worthResponding} worth responding to.`
              }
              action={opportunity.isDemoData ? <DemoBadge /> : null}
            />
            {comments.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing to analyse yet.
              </p>
            ) : (
              <ConversationThread comments={comments} analysis={analysis} />
            )}
          </Card>

          <ResponseCopilot
            opportunityId={opportunity.id}
            promotionRisk={opportunity.promotionRisk}
            recommendedAction={opportunity.recommendedAction}
            comments={comments.map((c) => ({
              id: c.id,
              author: c.author,
              body: c.body,
            }))}
            responses={opportunity.responses}
            generateAction={generateResponseAction}
            saveAction={saveResponseAction}
            markPostedAction={markResponsePostedAction}
          />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Recommended action" />
            <p className="text-sm font-semibold text-foreground">
              {opportunity.recommendedAction}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {opportunity.actionRationale}
            </p>
          </Card>

          <Card>
            <CardHeader title="Promotion risk" />
            <RiskBadge risk={opportunity.promotionRisk} />
            <p className="mt-2 text-sm text-muted">
              {opportunity.promotionRiskReason}
            </p>
          </Card>

          <Card>
            <CardHeader title="Score breakdown" />
            <ScoreBreakdown
              scores={{
                icpScore: opportunity.icpScore,
                problemScore: opportunity.problemScore,
                intentScore: opportunity.intentScore,
                recencyScore: opportunity.recencyScore,
                relevanceScore: opportunity.relevanceScore,
                engagementScore: opportunity.engagementScore,
              }}
            />
            <p className="mt-3 border-t border-border pt-3 text-sm">
              <span className="font-medium text-foreground">Overall</span>{" "}
              <span className="tabular-nums text-foreground">
                {opportunity.opportunityScore}/100
              </span>
            </p>
          </Card>

          <Card>
            <CardHeader title="Status" />
            <div className="flex flex-wrap gap-2">
              {(["REVIEWED", "IGNORED", "NEW"] as const).map((status) => (
                <form key={status} action={setOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value={status} />
                  <Button
                    type="submit"
                    variant={opportunity.status === status ? "primary" : "secondary"}
                  >
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </Button>
                </form>
              ))}
            </div>
          </Card>

          {opportunity.community ? (
            <Card>
              <CardHeader title="Community" />
              <p className="text-sm font-medium text-foreground">
                {opportunity.community.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                {opportunity.community.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>
                  Self-promotion: {opportunity.community.selfPromoRules}
                </Badge>
                {opportunity.community.memberCount ? (
                  <Badge>
                    {opportunity.community.memberCount.toLocaleString()} members
                  </Badge>
                ) : null}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
