"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OpportunityStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectWithIcp } from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import type { ResponseStyle } from "@/lib/ai/types";

export interface ResponseFormState {
  error?: string;
  ok?: boolean;
}

const RESPONSE_STYLES: ResponseStyle[] = [
  "helpful",
  "conversational",
  "short",
  "detailed",
  "technical",
  "experience-based",
];

/** Scopes every lookup to the signed-in founder's project. */
async function loadOwnedOpportunity(opportunityId: string) {
  const { project, icp } = await requireProjectWithIcp();
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, projectId: project.id },
  });
  if (!opportunity) throw new Error("Opportunity not found");
  return { project, icp, opportunity };
}

const generateSchema = z.object({
  opportunityId: z.string().min(1),
  style: z.enum(RESPONSE_STYLES as [ResponseStyle, ...ResponseStyle[]]),
  targetComment: z.string().optional(),
  allowProductMention: z.string().optional(),
});

export async function generateResponseAction(
  _prev: ResponseFormState,
  formData: FormData,
): Promise<ResponseFormState> {
  const parsed = generateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Pick a response style and try again" };

  const { opportunityId, style, targetComment } = parsed.data;
  // Checkbox semantics: absent means unchecked, so a mention is opt-in only.
  const allowProductMention = parsed.data.allowProductMention === "on";

  const { project, icp, opportunity } = await loadOwnedOpportunity(opportunityId);

  // Each draft can cost real money once a live provider is configured.
  const limited = rateLimit(
    `ai:${project.id}`,
    LIMITS.aiAction.limit,
    LIMITS.aiAction.windowSeconds,
  );
  if (!limited.allowed) {
    return {
      error: `You have generated a lot of drafts recently. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.`,
    };
  }

  let draft;
  try {
    draft = await getAIProvider().generateResponse({
      style,
      productName: project.name,
      productSummary: icp.productSummary,
      valueProposition: icp.valueProposition,
      postTitle: opportunity.title,
      postBody: opportunity.content,
      targetComment: targetComment || null,
      communityName: opportunity.communityName,
      platform: opportunity.platform,
      recommendedAction: opportunity.recommendedAction,
      promotionRisk: opportunity.promotionRisk,
      allowProductMention,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not generate a draft: ${error.message}`
          : "Could not generate a draft.",
    };
  }

  await prisma.response.create({
    data: {
      opportunityId,
      style,
      draft: draft.draft,
      mentionsProduct: draft.mentionsProduct,
      guidanceNote: draft.guidanceNote,
      status: "DRAFT",
    },
  });

  if (opportunity.status === "NEW") {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "REVIEWED" },
    });
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true };
}

const saveSchema = z.object({
  responseId: z.string().min(1),
  finalText: z.string().trim().min(1, "The response cannot be empty"),
});

export async function saveResponseAction(
  _prev: ResponseFormState,
  formData: FormData,
): Promise<ResponseFormState> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save" };
  }

  const { project } = await requireProjectWithIcp();
  const response = await prisma.response.findFirst({
    where: { id: parsed.data.responseId, opportunity: { projectId: project.id } },
    select: { id: true, opportunityId: true, status: true },
  });
  if (!response) return { error: "Response not found" };

  await prisma.response.update({
    where: { id: response.id },
    data: {
      finalText: parsed.data.finalText,
      status: response.status === "POSTED" ? "POSTED" : "EDITED",
    },
  });

  revalidatePath(`/opportunities/${response.opportunityId}`);
  return { ok: true };
}

/**
 * The founder posts the reply themselves on the platform and then records it
 * here. The product never posts on their behalf (PRD s18, s37).
 */
export async function markResponsePostedAction(formData: FormData): Promise<void> {
  const responseId = String(formData.get("responseId") ?? "");
  if (!responseId) return;

  const { project } = await requireProjectWithIcp();
  const response = await prisma.response.findFirst({
    where: { id: responseId, opportunity: { projectId: project.id } },
    select: { id: true, opportunityId: true, draft: true, finalText: true },
  });
  if (!response) return;

  await prisma.$transaction([
    prisma.response.update({
      where: { id: response.id },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        finalText: response.finalText ?? response.draft,
      },
    }),
    prisma.opportunity.update({
      where: { id: response.opportunityId },
      data: { status: "RESPONDED" },
    }),
    // Posting a reply is itself the first funnel event for this conversation.
    prisma.engagement.create({
      data: {
        projectId: project.id,
        opportunityId: response.opportunityId,
        platform: (
          await prisma.opportunity.findUniqueOrThrow({
            where: { id: response.opportunityId },
            select: { platform: true },
          })
        ).platform,
        stage: "ENGAGEMENT",
        action: "Posted response",
        count: 1,
      },
    }),
  ]);

  revalidatePath(`/opportunities/${response.opportunityId}`);
  revalidatePath("/tracking");
  revalidatePath("/dashboard");
}

export async function setOpportunityStatusAction(formData: FormData): Promise<void> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const status = String(formData.get("status") ?? "") as OpportunityStatus;
  if (!opportunityId) return;

  const valid: OpportunityStatus[] = ["NEW", "REVIEWED", "RESPONDED", "IGNORED"];
  if (!valid.includes(status)) return;

  const { project } = await requireProjectWithIcp();
  await prisma.opportunity.updateMany({
    where: { id: opportunityId, projectId: project.id },
    data: { status },
  });

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
}
