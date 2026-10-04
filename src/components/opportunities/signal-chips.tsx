import { Badge } from "@/components/ui";
import { RiskBadge } from "./opportunity-bits";
import type { PromotionRisk } from "@prisma/client";

/**
 * Compact chip row for the opportunity card's "Signals" section. Every chip
 * reads a score the backend already computed (icpScore/problemScore/
 * intentScore/relevanceScore/promotionRisk) — nothing here runs new
 * analysis or invents a value the scoring pipeline didn't already produce.
 *
 * The High/Medium/Low thresholds (60/35) are the same boundaries
 * `explainOpportunity` in opportunity-bits.tsx already uses for its "Strong
 * problem match" / "Some problem overlap" / "Weak problem match" text, so a
 * chip's label is always consistent with the "Why" line elsewhere on the
 * same card — this is a presentation choice, not a new scoring rule.
 */
type SignalLevel = "High" | "Medium" | "Low";

function levelOf(score: number): SignalLevel {
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function toneFor(level: SignalLevel): "success" | "brand" | "neutral" {
  if (level === "High") return "success";
  if (level === "Medium") return "brand";
  return "neutral";
}

function SignalChip({ label, score }: { label: string; score: number }) {
  const level = levelOf(score);
  return (
    <Badge tone={toneFor(level)} title={`${label}: ${score}/100`}>
      {label} {level}
    </Badge>
  );
}

export function SignalChips({
  problemScore,
  icpScore,
  intentScore,
  relevanceScore,
  promotionRisk,
}: {
  problemScore: number;
  icpScore: number;
  intentScore: number;
  relevanceScore: number;
  promotionRisk: PromotionRisk;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <SignalChip label="Problem match" score={problemScore} />
      <SignalChip label="Product fit" score={icpScore} />
      <SignalChip label="Customer intent" score={intentScore} />
      <SignalChip label="Use-case match" score={relevanceScore} />
      <RiskBadge risk={promotionRisk} />
    </div>
  );
}
