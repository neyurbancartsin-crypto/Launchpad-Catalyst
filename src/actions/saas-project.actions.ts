"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUserId, requireProjectWithIcp } from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";
import { syncOpportunities } from "@/lib/discovery";
import type { SaaSIntake } from "@/lib/ai/types";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const intakeSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  website: z.string().trim().url("Enter a valid URL, including https://"),
  description: z.string().trim().min(20, "Describe your product in at least 20 characters"),
  problemSolved: z.string().trim().min(20, "Describe the problem in at least 20 characters"),
  targetCustomer: z.string().trim().min(3, "Who is this for?"),
  category: z.string().trim().min(2, "Product category is required"),
  pricing: z.string().trim().min(1, "Pricing is required"),
  currentUsers: z.coerce.number().int().min(0).max(1_000_000),
  payingUsers: z.coerce.number().int().min(0).max(1_000_000),
  businessModel: z.enum(["B2B", "B2C", "B2B2C"]),
  targetGeography: z.string().trim().min(2, "Target geography is required"),
  competitors: z.string().trim().min(1, "List at least one competitor, or 'none'"),
  currentChannels: z.string().trim().min(1, "List your current channels, or 'none'"),
  biggestProblem: z.string().trim().min(10, "Describe your biggest acquisition problem"),
  marketingBudget: z.string().trim().max(120).optional().or(z.literal("")),
  hoursPerWeek: z.coerce.number().int().min(0).max(168).optional(),
  existingAudience: z.string().trim().max(300).optional().or(z.literal("")),
  socialProfiles: z.string().trim().max(300).optional().or(z.literal("")),
});

function readIntake(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return intakeSchema.safeParse({
    ...raw,
    hoursPerWeek: raw.hoursPerWeek === "" ? undefined : raw.hoursPerWeek,
  });
}

/**
 * Creates the project, runs the SaaS Analyzer and Channel Strategist, then
 * seeds opportunities so the founder lands on a populated workspace.
 */
export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readIntake(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers" };
  }

  const userId = await getSessionUserId();
  const data = parsed.data;

  const intake: SaaSIntake = {
    ...data,
    marketingBudget: data.marketingBudget || null,
    hoursPerWeek: data.hoursPerWeek ?? null,
    existingAudience: data.existingAudience || null,
    socialProfiles: data.socialProfiles || null,
  };

  const ai = getAIProvider();
  const analysis = await ai.analyzeSaaS(intake);
  const channels = await ai.recommendChannels(intake, analysis);

  const existing = await prisma.saaSProject.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const project = existing
    ? await prisma.saaSProject.update({
        where: { id: existing.id },
        data: { ...data, ...optionalFields(data), onboardingComplete: true, aiAnalysisRaw: analysis as unknown as object },
      })
    : await prisma.saaSProject.create({
        data: {
          userId,
          ...data,
          ...optionalFields(data),
          onboardingComplete: true,
          aiAnalysisRaw: analysis as unknown as object,
        },
      });

  const icp = await prisma.iCP.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      productSummary: analysis.productSummary,
      coreProblem: analysis.coreProblem,
      valueProposition: analysis.valueProposition,
      productCategory: analysis.productCategory,
      primaryCustomer: analysis.primaryCustomer,
      secondaryCustomer: analysis.secondaryCustomer,
      roles: analysis.roles,
      industries: analysis.industries,
      companySize: analysis.companySize,
      painPoints: analysis.painPoints,
      buyingTriggers: analysis.buyingTriggers,
      objections: analysis.objections,
      problemMap: analysis.problemMap as unknown as object,
      searchTopics: analysis.searchTopics,
      intentSignals: analysis.intentSignals,
    },
    update: {
      productSummary: analysis.productSummary,
      coreProblem: analysis.coreProblem,
      valueProposition: analysis.valueProposition,
      productCategory: analysis.productCategory,
      primaryCustomer: analysis.primaryCustomer,
      secondaryCustomer: analysis.secondaryCustomer,
      roles: analysis.roles,
      industries: analysis.industries,
      companySize: analysis.companySize,
      painPoints: analysis.painPoints,
      buyingTriggers: analysis.buyingTriggers,
      objections: analysis.objections,
      problemMap: analysis.problemMap as unknown as object,
      searchTopics: analysis.searchTopics,
      intentSignals: analysis.intentSignals,
    },
  });

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: {
        projectId_platform: { projectId: project.id, platform: channel.platform },
      },
      create: { projectId: project.id, ...channel },
      update: { ...channel },
    });
  }

  await syncOpportunities(project, icp);

  revalidatePath("/", "layout");
  redirect("/strategy?onboarded=1");
}

function optionalFields(data: z.infer<typeof intakeSchema>) {
  return {
    marketingBudget: data.marketingBudget || null,
    hoursPerWeek: data.hoursPerWeek ?? null,
    existingAudience: data.existingAudience || null,
    socialProfiles: data.socialProfiles || null,
  };
}

// --- ICP editing (PRD s6: the founder must be able to edit the analysis) ----

const icpEditSchema = z.object({
  primaryCustomer: z.string().trim().min(1),
  secondaryCustomer: z.string().trim().min(1),
  companySize: z.string().trim().min(1),
  roles: z.string(),
  industries: z.string(),
  painPoints: z.string(),
  buyingTriggers: z.string(),
  objections: z.string(),
  searchTopics: z.string(),
  intentSignals: z.string(),
});

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function updateIcpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { icp } = await requireProjectWithIcp();

  const parsed = icpEditSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Primary customer, secondary customer and company size are required" };
  }

  const data = parsed.data;
  await prisma.iCP.update({
    where: { id: icp.id },
    data: {
      primaryCustomer: data.primaryCustomer,
      secondaryCustomer: data.secondaryCustomer,
      companySize: data.companySize,
      roles: toLines(data.roles),
      industries: toLines(data.industries),
      painPoints: toLines(data.painPoints),
      buyingTriggers: toLines(data.buyingTriggers),
      objections: toLines(data.objections),
      searchTopics: toLines(data.searchTopics),
      intentSignals: toLines(data.intentSignals),
      editedByUser: true,
    },
  });

  revalidatePath("/strategy");
  return { ok: true };
}

/** Re-runs discovery against the current (possibly edited) ICP. */
export async function refreshOpportunitiesAction(): Promise<void> {
  const { project, icp } = await requireProjectWithIcp();
  const summary = await syncOpportunities(project, icp);

  // Surface unreachable platforms rather than letting them look like
  // "no opportunities found" (PRD s35).
  const failures = summary.perPlatform.filter((p) => p.error);
  if (failures.length > 0) {
    await prisma.saaSProject.update({
      where: { id: project.id },
      data: {
        lastSyncError: failures
          .map((f) => `${f.platform}: ${f.error}`)
          .join(" | "),
        lastSyncedAt: new Date(),
      },
    });
  } else {
    await prisma.saaSProject.update({
      where: { id: project.id },
      data: { lastSyncError: null, lastSyncedAt: new Date() },
    });
  }

  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
}
