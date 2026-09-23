import Link from "next/link";
import type { Opportunity } from "@prisma/client";
import { setOpportunityStatusAction } from "@/actions/responses.actions";
import { Badge, Button } from "@/components/ui";
import { DemoBadge } from "@/components/ui/demo-badge";
import {
  explainOpportunity,
  PlatformBadge,
  relativeTime,
  ScoreBadge,
  TierBadge,
} from "./opportunity-bits";

/**
 * Phase 9's card: score/tier up top, the conversation itself, why it was
 * ranked this way, the recommended action, then quick triage actions.
 * Deep actions (Analyze conversation, Generate response) stay on the detail
 * page — this card is for triage, not the full workflow.
 */
export function OpportunityCard({
  opportunity,
  isNew,
}: {
  opportunity: Opportunity;
  isNew: boolean;
}) {
  const dismissed = opportunity.status === "IGNORED";
  const saved = opportunity.status === "SAVED";

  return (
    <li
      className={`rounded-xl border p-4 ${
        dismissed ? "border-border/60 bg-surface-muted/40 opacity-70" : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ScoreBadge score={opportunity.opportunityScore} band={opportunity.priorityBand} />
        <TierBadge band={opportunity.priorityBand} />
        <PlatformBadge platform={opportunity.platform} />
        <Badge>{opportunity.communityName}</Badge>
        {isNew ? <Badge tone="brand">New</Badge> : null}
        {saved ? <Badge tone="success">Saved</Badge> : null}
        {dismissed ? <Badge>Dismissed</Badge> : null}
        {opportunity.status === "RESPONDED" ? <Badge tone="brand">Responded</Badge> : null}
        {opportunity.isDemoData ? <DemoBadge /> : null}
      </div>

      <Link href={`/opportunities/${opportunity.id}`} className="block">
        <h2 className="text-sm font-semibold text-foreground hover:text-brand">
          {opportunity.title}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{opportunity.content}</p>
      </Link>

      <p className="mt-2 text-xs text-muted">
        {opportunity.author} · {relativeTime(opportunity.postedAt)} · {opportunity.commentCount}{" "}
        comments
      </p>

      <p className="mt-2 text-xs text-muted">
        <span className="font-medium text-foreground">Why: </span>
        {explainOpportunity(opportunity)}
      </p>

      <p className="mt-1 text-xs text-muted">
        <span className="font-medium text-foreground">Recommended: </span>
        {opportunity.recommendedAction}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Link href={`/opportunities/${opportunity.id}`}>
          <Button variant="secondary">Open</Button>
        </Link>
        {!dismissed ? (
          <form action={setOpportunityStatusAction}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <input type="hidden" name="status" value={saved ? "NEW" : "SAVED"} />
            <Button variant="secondary" type="submit">
              {saved ? "Unsave" : "Save"}
            </Button>
          </form>
        ) : null}
        <form action={setOpportunityStatusAction}>
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <input type="hidden" name="status" value={dismissed ? "NEW" : "IGNORED"} />
          <Button variant="ghost" type="submit">
            {dismissed ? "Restore" : "Dismiss"}
          </Button>
        </form>
      </div>
    </li>
  );
}
