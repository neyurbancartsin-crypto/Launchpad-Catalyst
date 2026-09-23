"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProjectWithIcp } from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export interface AnalyzeConversationFormState {
  error?: string;
  ok?: boolean;
}

/** Matches the shape `discovery.ts` serialises into `Conversation.comments`. */
interface StoredComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  upvotes: number;
  depth: number;
  isOp: boolean;
  createdAt: string;
}

const analyzeSchema = z.object({
  opportunityId: z.string().min(1),
});

/**
 * Explicit, on-demand comment-thread analysis (PRD s10). Discovery only
 * retrieves and persists comments (no AI); this is the one place the
 * founder actually spends an AI call on a conversation, one opportunity at
 * a time. Mirrors `generateResponseAction`'s shape: ownership check, rate
 * limit, a specific error on failure, exactly one AI call on success.
 */
export async function analyzeConversationAction(
  _prev: AnalyzeConversationFormState,
  formData: FormData,
): Promise<AnalyzeConversationFormState> {
  const parsed = analyzeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Missing opportunity" };

  const { project, icp } = await requireProjectWithIcp();
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: parsed.data.opportunityId, projectId: project.id },
    include: { conversation: true },
  });
  if (!opportunity) return { error: "Opportunity not found" };

  const comments =
    (opportunity.conversation?.comments as unknown as StoredComment[]) ?? [];
  if (comments.length === 0) {
    return { error: "No comments have been retrieved for this post yet." };
  }

  // Each analysis pass can cost real money once a live provider is configured.
  const limited = rateLimit(
    `ai:${project.id}`,
    LIMITS.aiAction.limit,
    LIMITS.aiAction.windowSeconds,
  );
  if (!limited.allowed) {
    return {
      error: `You have run a lot of AI actions recently. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const icpKeywords = [...icp.searchTopics, ...icp.roles];

  let analysis;
  try {
    analysis = await getAIProvider().analyzeConversation({
      postTitle: "",
      postBody: opportunity.content,
      comments: comments.map((comment) => ({
        externalId: comment.id,
        author: comment.author,
        body: comment.body,
        upvotes: comment.upvotes,
        isOp: comment.isOp,
      })),
      icpKeywords,
      intentSignals: icp.intentSignals,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not analyze this conversation: ${error.message}`
          : "Could not analyze this conversation.",
    };
  }

  await prisma.conversation.update({
    where: { opportunityId: opportunity.id },
    data: { analysis: analysis as unknown as object },
  });

  revalidatePath(`/opportunities/${opportunity.id}`);
  return { ok: true };
}
