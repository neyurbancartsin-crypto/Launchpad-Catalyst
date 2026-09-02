import { SCORE_WEIGHTS } from "@/lib/scoring/opportunity-score";

const ROWS = [
  { key: "icpScore", label: "ICP match", weight: SCORE_WEIGHTS.icpScore },
  { key: "problemScore", label: "Problem match", weight: SCORE_WEIGHTS.problemScore },
  { key: "intentScore", label: "Intent", weight: SCORE_WEIGHTS.intentScore },
  { key: "recencyScore", label: "Recency", weight: SCORE_WEIGHTS.recencyScore },
  { key: "relevanceScore", label: "Relevance", weight: SCORE_WEIGHTS.relevanceScore },
  { key: "engagementScore", label: "Engagement", weight: SCORE_WEIGHTS.engagementScore },
] as const;

/** Shows how the overall score was reached, so it is auditable rather than opaque. */
export function ScoreBreakdown({
  scores,
}: {
  scores: Record<(typeof ROWS)[number]["key"], number>;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs tracking-wide text-muted uppercase">
          <th className="pb-2 font-medium">Component</th>
          <th className="pb-2 text-right font-medium">Score</th>
          <th className="pb-2 text-right font-medium">Weight</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => {
          const value = scores[row.key];
          return (
            <tr key={row.key} className="border-t border-border">
              <td className="py-2">
                <span className="text-foreground">{row.label}</span>
                <span
                  aria-hidden
                  className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
                >
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${value}%` }}
                  />
                </span>
              </td>
              <td className="py-2 text-right align-top tabular-nums text-foreground">
                {value}
              </td>
              <td className="py-2 text-right align-top tabular-nums text-muted">
                {Math.round(row.weight * 100)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
