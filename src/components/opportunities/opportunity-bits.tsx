import type { Platform, PriorityBand, PromotionRisk } from "@prisma/client";
import { Badge } from "@/components/ui";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";

export const BAND_LABELS: Record<PriorityBand, string> = {
  HIGH: "High priority",
  REVIEW: "Worth reviewing",
  LOW: "Low priority",
  DEPRIORITISE: "Do not prioritise",
};

/**
 * Relevant != opportunity: the same deterministic score already drives this
 * distinction (PRD) — a HIGH/REVIEW band means real problem+intent match,
 * while LOW/DEPRIORITISE means the topic may be related but the conversation
 * itself isn't a good place to acquire a customer. No new field, purely a
 * founder-facing label over the existing `priorityBand`.
 */
export const OPPORTUNITY_TIER: Record<
  PriorityBand,
  { label: string; hint: string }
> = {
  HIGH: {
    label: "High Opportunity",
    hint: "Strong problem match and real intent — a good place to help.",
  },
  REVIEW: {
    label: "Opportunity",
    hint: "Decent problem and intent match — worth a look.",
  },
  LOW: {
    label: "Relevant",
    hint: "Related to your product, but weak customer intent.",
  },
  DEPRIORITISE: {
    label: "Low Relevance",
    hint: "Weak fit or mostly superficial keyword overlap.",
  },
};

/** Short, plain-language reason string, e.g. "Strong problem match · High intent · Low promotion risk". */
export function explainOpportunity(o: {
  problemScore: number;
  intentScore: number;
  promotionRisk: PromotionRisk;
}): string {
  const problem =
    o.problemScore >= 60
      ? "Strong problem match"
      : o.problemScore >= 35
        ? "Some problem overlap"
        : "Weak problem match";
  const intent =
    o.intentScore >= 60 ? "High intent" : o.intentScore >= 35 ? "Some intent" : "Low intent";
  const risk =
    o.promotionRisk === "LOW"
      ? "Low promotion risk"
      : o.promotionRisk === "MEDIUM"
        ? "Medium promotion risk"
        : "High promotion risk";
  return [problem, intent, risk].join(" · ");
}

/**
 * Opportunity strength reads through lime intensity, not a traffic-light
 * success/warning scale: HIGH gets the strong solid-lime signal, REVIEW the
 * soft lime tint, and anything below that is deliberately neutral —
 * warning/danger stay reserved for actual promotion risk (see RiskBadge).
 * Shared by every lime-accented element on an opportunity (badges, the
 * card's own highlight border) so the same band always reads the same way.
 */
export function bandTone(band: PriorityBand): "opportunity" | "brand" | "neutral" {
  return band === "HIGH" ? "opportunity" : band === "REVIEW" ? "brand" : "neutral";
}

export function ScoreBadge({
  score,
  band,
}: {
  score: number;
  band: PriorityBand;
}) {
  return (
    <Badge tone={bandTone(band)} title={BAND_LABELS[band]}>
      {score}/100
    </Badge>
  );
}

export function TierBadge({ band }: { band: PriorityBand }) {
  const tier = OPPORTUNITY_TIER[band];
  return (
    <Badge tone={bandTone(band)} title={tier.hint}>
      {tier.label}
    </Badge>
  );
}

export function RiskBadge({ risk }: { risk: PromotionRisk }) {
  const tone = risk === "LOW" ? "success" : risk === "MEDIUM" ? "warning" : "danger";
  const label =
    risk === "LOW"
      ? "Low promo risk"
      : risk === "MEDIUM"
        ? "Medium promo risk"
        : "High promo risk";
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * A distinct, muted accent per discovery source so a founder scanning a
 * mixed-source list can tell GitHub/Hacker News/Stack Overflow apart at a
 * glance (PRD: conversation source styling). Deferred platforms (Reddit, X,
 * LinkedIn) have no live discovery yet — they fall back to the plain neutral
 * tone rather than inventing an accent for a source nothing currently finds.
 */
const SOURCE_TONE: Record<Platform, "source-github" | "source-hackernews" | "source-stackoverflow" | "neutral"> = {
  GITHUB: "source-github",
  HACKERNEWS: "source-hackernews",
  STACKOVERFLOW: "source-stackoverflow",
  REDDIT: "neutral",
  X: "neutral",
  LINKEDIN: "neutral",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <Badge tone={SOURCE_TONE[platform]}>{PLATFORM_LABELS[platform]}</Badge>;
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
