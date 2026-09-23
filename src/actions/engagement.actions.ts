"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import { FUNNEL_STAGES } from "@/lib/funnel";

export interface EngagementFormState {
  error?: string;
  ok?: boolean;
}

const logSchema = z.object({
  // The full enum, not just the active discovery platforms — a founder can
  // still log engagement against a deferred platform from earlier activity.
  platform: z.nativeEnum(Platform),
  stage: z.enum(FUNNEL_STAGES as [string, ...string[]]),
  opportunityId: z.string().optional(),
  action: z.string().trim().max(120).optional(),
  count: z.coerce.number().int().min(1).max(10_000),
  notes: z.string().trim().max(1000).optional(),
});

export async function logEngagementAction(
  _prev: EngagementFormState,
  formData: FormData,
): Promise<EngagementFormState> {
  const parsed = logSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const project = await requireProject();
  const data = parsed.data;

  // An opportunity id from the form must belong to this project.
  let opportunityId: string | null = null;
  if (data.opportunityId) {
    const owned = await prisma.opportunity.findFirst({
      where: { id: data.opportunityId, projectId: project.id },
      select: { id: true },
    });
    if (!owned) return { error: "That opportunity could not be found" };
    opportunityId = owned.id;
  }

  await prisma.engagement.create({
    data: {
      projectId: project.id,
      opportunityId,
      platform: data.platform,
      stage: data.stage as (typeof FUNNEL_STAGES)[number],
      action: data.action || null,
      count: data.count,
      notes: data.notes || null,
    },
  });

  revalidatePath("/tracking");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteEngagementAction(formData: FormData): Promise<void> {
  const id = String(formData.get("engagementId") ?? "");
  if (!id) return;

  const project = await requireProject();
  await prisma.engagement.deleteMany({
    where: { id, projectId: project.id },
  });

  revalidatePath("/tracking");
  revalidatePath("/dashboard");
}
