import type { Platform, PriorityBand, PromotionRisk } from "@prisma/client";
import { Badge } from "@/components/ui";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";

export const BAND_LABELS: Record<PriorityBand, string> = {
  HIGH: "High priority",
  REVIEW: "Worth reviewing",
  LOW: "Low priority",
  DEPRIORITISE: "Do not prioritise",
};

export function ScoreBadge({
  score,
  band,
}: {
  score: number;
  band: PriorityBand;
}) {
  const tone =
    band === "HIGH"
      ? "success"
      : band === "REVIEW"
        ? "brand"
        : band === "LOW"
          ? "warning"
          : "neutral";
  return (
    <Badge tone={tone} title={BAND_LABELS[band]}>
      {score}/100
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

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <Badge>{PLATFORM_LABELS[platform]}</Badge>;
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
