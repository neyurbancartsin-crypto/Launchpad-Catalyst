import type { EngagementStage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/funnel";

/**
 * The acquisition funnel (PRD s20). Bars are scaled against the widest stage so
 * the drop-off between steps is the thing you actually see.
 */
export function FunnelView({
  stages,
}: {
  stages: { stage: EngagementStage; count: number }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <ol className="space-y-2">
      {stages.map((row, index) => {
        const previous = index > 0 ? stages[index - 1].count : null;
        const dropOff =
          previous && previous > 0 && row.count < previous
            ? Math.round((1 - row.count / previous) * 100)
            : null;

        return (
          <li key={row.stage} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted">
              {STAGE_LABELS[row.stage]}
            </span>
            <span className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-surface-muted">
              <span
                className="flex h-full items-center rounded bg-brand px-2 text-xs font-medium text-brand-foreground"
                style={{ width: `${Math.max((row.count / max) * 100, row.count > 0 ? 6 : 0)}%` }}
              >
                {row.count > 0 ? row.count : null}
              </span>
            </span>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
              {row.count === 0 ? "—" : dropOff !== null ? `-${dropOff}%` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
