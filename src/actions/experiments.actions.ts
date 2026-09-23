"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";

export interface ExperimentFormState {
  error?: string;
  ok?: boolean;
}

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Give the experiment a name").max(120),
    hypothesis: z.string().trim().min(10, "Describe what you expect to happen"),
    // The full enum, not just the active discovery platforms — a founder can
    // still record an experiment against a deferred platform.
    channel: z.union([z.nativeEnum(Platform), z.literal("")]).optional(),
    action: z.string().trim().min(5, "Describe the action you will take"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    targetConversations: z.coerce.number().int().min(0).max(10_000),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "The end date must be on or after the start date",
    path: ["endDate"],
  });

export async function createExperimentAction(
  _prev: ExperimentFormState,
  formData: FormData,
): Promise<ExperimentFormState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const project = await requireProject();
  const data = parsed.data;
  const now = new Date();

  const experiment = await prisma.experiment.create({
    data: {
      projectId: project.id,
      name: data.name,
      hypothesis: data.hypothesis,
      channel: data.channel ? data.channel : null,
      action: data.action,
      startDate: data.startDate,
      endDate: data.endDate,
      targetConversations: data.targetConversations,
      status: data.startDate <= now ? "RUNNING" : "PLANNED",
    },
  });

  revalidatePath("/experiments");
  redirect(`/experiments/${experiment.id}`);
}

const resultSchema = z.object({
  experimentId: z.string().min(1),
  conversations: z.coerce.number().int().min(0).max(100_000),
  websiteVisits: z.coerce.number().int().min(0).max(100_000),
  signups: z.coerce.number().int().min(0).max(100_000),
  activatedUsers: z.coerce.number().int().min(0).max(100_000),
  paidUsers: z.coerce.number().int().min(0).max(100_000),
});

export async function saveExperimentResultAction(
  _prev: ExperimentFormState,
  formData: FormData,
): Promise<ExperimentFormState> {
  const parsed = resultSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the numbers" };
  }

  const project = await requireProject();
  const { experimentId, ...metrics } = parsed.data;

  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, projectId: project.id },
    select: { id: true },
  });
  if (!experiment) return { error: "Experiment not found" };

  await prisma.experimentResult.upsert({
    where: { experimentId },
    create: { experimentId, ...metrics },
    update: metrics,
  });

  revalidatePath(`/experiments/${experimentId}`);
  return { ok: true };
}

/** Runs the Growth Analyst over the recorded results (PRD s23). */
export async function analyzeExperimentAction(formData: FormData): Promise<void> {
  const experimentId = String(formData.get("experimentId") ?? "");
  if (!experimentId) return;

  const project = await requireProject();
  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, projectId: project.id },
    include: { result: true },
  });
  if (!experiment?.result) return;

  const analysis = await getAIProvider().analyzeExperiment({
    hypothesis: experiment.hypothesis,
    action: experiment.action,
    targetConversations: experiment.targetConversations,
    conversations: experiment.result.conversations,
    websiteVisits: experiment.result.websiteVisits,
    signups: experiment.result.signups,
    activatedUsers: experiment.result.activatedUsers,
    paidUsers: experiment.result.paidUsers,
  });

  await prisma.$transaction([
    prisma.experimentResult.update({
      where: { experimentId },
      data: {
        aiAnalysis: {
          whatHappened: analysis.whatHappened,
          interpretation: analysis.interpretation,
          nextExperiment: analysis.nextExperiment,
        },
        bottleneck: analysis.bottleneck,
      },
    }),
    prisma.experiment.update({
      where: { id: experimentId },
      data: { status: "COMPLETE" },
    }),
  ]);

  revalidatePath(`/experiments/${experimentId}`);
  revalidatePath("/experiments");
  revalidatePath("/dashboard");
}
