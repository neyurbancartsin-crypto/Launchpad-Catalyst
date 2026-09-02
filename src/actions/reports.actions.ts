"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProject, requireProjectWithIcp } from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";
import { getFunnelCounts, getPerPlatformCounts } from "@/lib/funnel";

export interface ReportFormState {
  error?: string;
  ok?: boolean;
}

const REPORT_WINDOW_DAYS = 7;

/** Generates the weekly growth report (PRD s24-s25). */
export async function generateWeeklyReportAction(): Promise<void> {
  const { project, icp } = await requireProjectWithIcp();

  const periodEnd = new Date();
  const periodStart = new Date(
    periodEnd.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [funnel, perPlatform, responsesPosted, conversationsStarted] =
    await Promise.all([
      getFunnelCounts(project.id, periodStart),
      getPerPlatformCounts(project.id, periodStart),
      prisma.response.count({
        where: {
          opportunity: { projectId: project.id },
          status: "POSTED",
          postedAt: { gte: periodStart },
        },
      }),
      prisma.engagement.count({
        where: {
          projectId: project.id,
          stage: "ENGAGEMENT",
          loggedAt: { gte: periodStart },
        },
      }),
    ]);

  const analysis = await getAIProvider().analyzeGrowth({
    periodStart,
    periodEnd,
    funnel,
    perPlatform,
    topTopics: icp.searchTopics.slice(0, 5),
    conversationsStarted,
    responsesPosted,
  });

  await prisma.growthReport.create({
    data: {
      projectId: project.id,
      periodStart,
      periodEnd,
      bottleneck: analysis.bottleneck,
      payload: {
        ...analysis,
        funnel,
        perPlatform,
        responsesPosted,
        conversationsStarted,
      } as unknown as object,
    },
  });

  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

const auditSchema = z.object({
  url: z.string().trim().url("Enter a valid URL, including https://"),
});

export async function analyzeLandingPageAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const parsed = auditSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid URL" };
  }

  const { project, icp } = await requireProjectWithIcp();
  const analysis = await getAIProvider().analyzeLandingPage({
    url: parsed.data.url,
    productName: project.name,
    valueProposition: icp.valueProposition,
    primaryCustomer: icp.primaryCustomer,
  });

  await prisma.landingPageAudit.create({
    data: {
      projectId: project.id,
      url: parsed.data.url,
      payload: analysis as unknown as object,
    },
  });

  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteReportAction(formData: FormData): Promise<void> {
  const id = String(formData.get("reportId") ?? "");
  if (!id) return;

  const project = await requireProject();
  await prisma.growthReport.deleteMany({ where: { id, projectId: project.id } });
  revalidatePath("/reports");
}
