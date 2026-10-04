"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import type { FeedbackStatus } from "@prisma/client";

const FEEDBACK_TYPES = ["SUGGESTION", "FEATURE_REQUEST", "BUG_REPORT", "OTHER"] as const;
const FEEDBACK_STATUSES = ["NEW", "REVIEWED", "PLANNED", "DONE"] as const;

const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  type: z.enum(FEEDBACK_TYPES, { message: "Choose a feedback type" }),
  message: z
    .string()
    .trim()
    .min(5, "Say a little more — at least 5 characters")
    .max(4000, "Keep it under 4000 characters"),
  // FormData.get() returns null (not undefined) for a field that wasn't
  // submitted at all — an unchecked checkbox simply isn't sent — so this
  // must accept null, not just undefined, for `.optional()` to actually work.
  consent: z.literal("on").nullish(),
});

export interface FeedbackFormState {
  error?: string;
  ok?: boolean;
}

/**
 * Reachable only from the authenticated dashboard's "Give Feedback" modal,
 * but doesn't itself require a session — `userId` is simply attached when
 * one exists, matching the schema's optional `Feedback.userId`.
 */
export async function submitFeedbackAction(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const parsed = feedbackSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    type: formData.get("type"),
    message: formData.get("message"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers" };
  }

  const session = await auth();

  await prisma.feedback.create({
    data: {
      userId: session?.user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      type: parsed.data.type,
      message: parsed.data.message,
      consent: parsed.data.consent === "on",
    },
  });

  return { ok: true };
}

const statusUpdateSchema = z.object({
  feedbackId: z.string().min(1),
  status: z.enum(FEEDBACK_STATUSES),
});

/** Owner-only. Re-checks admin status itself — never trust that only the
 * inbox page's own form could have called this. */
export async function updateFeedbackStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = statusUpdateSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await prisma.feedback.update({
    where: { id: parsed.data.feedbackId },
    data: { status: parsed.data.status as FeedbackStatus },
  });

  revalidatePath("/feedback-inbox");
}
