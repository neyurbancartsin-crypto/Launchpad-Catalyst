import Link from "next/link";
import type { Opportunity } from "@prisma/client";
import { setOpportunityStatusAction } from "@/actions/responses.actions";
import { Badge, Button } from "@/components/ui";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ConversationExcerpt } from "./conversation-excerpt";
import { SignalChips } from "./signal-chips";
import {
  bandTone,
  OPPORTUNITY_TIER,
  PlatformBadge,
  relativeTime,
  ScoreBadge,
  TierBadge,
} from "./opportunity-bits";

/**
 * Scan-first card: metadata and score up top, the actual quote next, then a
 * short "why / opportunity / signals / action" breakdown instead of a wall
 * of prose — a founder should know what this is and what to do about it in
 * a few seconds, with the full conversation one click away (not deleted,
 * just not the first thing on screen). Every value here already exists on
 * the Opportunity row; nothing here changes what gets discovered, scored, or
 * recommended.
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
  const tier = OPPORTUNITY_TIER[opportunity.priorityBand];
  const tone = bandTone(opportunity.priorityBand);

  return (
    <li
      className={`overflow-hidden rounded-xl border ${
        dismissed ? "border-border/60 bg-surface-muted/40 opacity-70" : "border-border bg-surface"
      } ${tone === "opportunity" ? "border-l-4 border-l-opportunity" : tone === "brand" ? "border-l-4 border-l-brand-border" : ""}`}
    >
      {/* Metadata header — kept separate from the conversation itself. */}
      <div
        className={`flex flex-wrap items-center gap-2 px-4 pt-3 pb-2.5 ${
          tone === "opportunity" ? "bg-opportunity-soft" : ""
        }`}
      >
        <PlatformBadge platform={opportunity.platform} />
        <ScoreBadge score={opportunity.opportunityScore} band={opportunity.priorityBand} />
        <TierBadge band={opportunity.priorityBand} />
        <Badge>{opportunity.communityName}</Badge>
        {isNew ? <Badge tone="brand">New</Badge> : null}
        {saved ? <Badge tone="success">Saved</Badge> : null}
        {dismissed ? <Badge>Dismissed</Badge> : null}
        {opportunity.status === "RESPONDED" ? <Badge tone="brand">Responded</Badge> : null}
        {opportunity.isDemoData ? <DemoBadge /> : null}
        <span className="ml-auto text-xs text-muted">
          {opportunity.author} · {relativeTime(opportunity.postedAt)}
        </span>
      </div>

      <div className="space-y-3 px-4 pb-4">
        <Link href={`/opportunities/${opportunity.id}`} className="block">
          <h2 className="text-sm font-semibold text-foreground hover:text-brand">
            {opportunity.title}
          </h2>
        </Link>

        <section>
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            Why this matters
          </p>
          <p className="text-sm text-foreground">{tier.hint}</p>
        </section>

        <section className="rounded-lg border border-border/70 bg-surface-muted/40 p-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            What the person is saying
          </p>
          <ConversationExcerpt text={opportunity.content} />
        </section>

        <section>
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            Opportunity
          </p>
          <p className="text-sm text-foreground">{opportunity.actionRationale}</p>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Signals
          </p>
          <SignalChips
            problemScore={opportunity.problemScore}
            icpScore={opportunity.icpScore}
            intentScore={opportunity.intentScore}
            relevanceScore={opportunity.relevanceScore}
            promotionRisk={opportunity.promotionRisk}
          />
        </section>

        <section className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Recommended:
          </span>
          <Badge tone={tone}>{opportunity.recommendedAction}</Badge>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Link href={`/opportunities/${opportunity.id}`}>
            <Button variant="secondary">Read conversation</Button>
          </Link>
          <a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Open in original ↗</Button>
          </a>
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
      </div>
    </li>
  );
}
