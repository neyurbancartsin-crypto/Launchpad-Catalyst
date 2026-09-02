import type { CommentAnalysis } from "@/lib/ai/types";
import { Badge } from "@/components/ui";
import { relativeTime } from "./opportunity-bits";

export interface StoredComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  upvotes: number;
  depth: number;
  isOp: boolean;
  createdAt: string;
}

/**
 * Renders the retrieved comment thread with the conversation analysis attached
 * (PRD s10-s12): which comments come from potential customers, which express a
 * real problem, and which are worth responding to.
 */
export function ConversationThread({
  comments,
  analysis,
}: {
  comments: StoredComment[];
  analysis: CommentAnalysis[];
}) {
  const byComment = new Map(analysis.map((entry) => [entry.commentExternalId, entry]));

  return (
    <ol className="space-y-3">
      {comments.map((comment) => {
        const insight = byComment.get(comment.id);
        const highlight = insight?.worthResponding ?? false;

        return (
          <li
            key={comment.id}
            style={{ marginLeft: `${Math.min(comment.depth, 3) * 20}px` }}
          >
            <article
              className={`rounded-lg border p-3 ${
                highlight
                  ? "border-[#bde3d1] bg-success-soft/40"
                  : "border-border bg-surface"
              }`}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {comment.author}
                </span>
                {comment.isOp ? <Badge tone="brand">OP</Badge> : null}
                <span className="text-xs text-muted">
                  {comment.upvotes} upvotes · {relativeTime(new Date(comment.createdAt))}
                </span>
              </div>

              <p className="text-sm text-foreground">{comment.body}</p>

              {insight ? (
                <div className="mt-2.5 border-t border-border/70 pt-2.5">
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    <Badge
                      tone={
                        insight.icpMatch === "High"
                          ? "success"
                          : insight.icpMatch === "Medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      ICP {insight.icpMatch}
                    </Badge>
                    <Badge
                      tone={
                        insight.intent === "High"
                          ? "success"
                          : insight.intent === "Medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      Intent {insight.intent}
                    </Badge>
                    {insight.problemExpressed ? (
                      <Badge tone="brand">Problem expressed</Badge>
                    ) : null}
                    {insight.worthResponding ? (
                      <Badge tone="success">Worth responding</Badge>
                    ) : (
                      <Badge>Skip</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted">{insight.reason}</p>
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
