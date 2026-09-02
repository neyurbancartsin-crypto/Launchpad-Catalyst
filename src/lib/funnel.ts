import type { EngagementStage, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { FunnelCounts } from "@/lib/ai/types";

export const FUNNEL_STAGES: EngagementStage[] = [
  "OPPORTUNITY",
  "ENGAGEMENT",
  "PROFILE_VISIT",
  "WEBSITE_VISIT",
  "SIGNUP",
  "ACTIVATION",
  "PAID",
];

export const STAGE_LABELS: Record<EngagementStage, string> = {
  OPPORTUNITY: "Opportunity",
  ENGAGEMENT: "Engagement",
  PROFILE_VISIT: "Profile visit",
  WEBSITE_VISIT: "Website visit",
  SIGNUP: "Signup",
  ACTIVATION: "Activation",
  PAID: "Paid user",
};

export interface StageCounts {
  stage: EngagementStage;
  count: number;
}

export async function getStageCounts(
  projectId: string,
  since?: Date,
): Promise<StageCounts[]> {
  const grouped = await prisma.engagement.groupBy({
    by: ["stage"],
    where: { projectId, ...(since ? { loggedAt: { gte: since } } : {}) },
    _sum: { count: true },
  });

  const bySage = new Map(grouped.map((row) => [row.stage, row._sum.count ?? 0]));
  return FUNNEL_STAGES.map((stage) => ({
    stage,
    count: bySage.get(stage) ?? 0,
  }));
}

/**
 * The OPPORTUNITY stage is derived from discovered opportunities rather than
 * logged manually — the founder should not have to record what the product
 * already knows.
 */
export async function getFunnelCounts(
  projectId: string,
  since?: Date,
): Promise<FunnelCounts> {
  const [stages, opportunities] = await Promise.all([
    getStageCounts(projectId, since),
    prisma.opportunity.count({
      where: { projectId, ...(since ? { discoveredAt: { gte: since } } : {}) },
    }),
  ]);

  const value = (stage: EngagementStage) =>
    stages.find((row) => row.stage === stage)?.count ?? 0;

  return {
    opportunities,
    engagements: value("ENGAGEMENT"),
    profileVisits: value("PROFILE_VISIT"),
    websiteVisits: value("WEBSITE_VISIT"),
    signups: value("SIGNUP"),
    activations: value("ACTIVATION"),
    paid: value("PAID"),
  };
}

export async function getPerPlatformCounts(
  projectId: string,
  since?: Date,
): Promise<{ platform: Platform; engagements: number; signups: number }[]> {
  const grouped = await prisma.engagement.groupBy({
    by: ["platform", "stage"],
    where: { projectId, ...(since ? { loggedAt: { gte: since } } : {}) },
    _sum: { count: true },
  });

  const platforms: Platform[] = ["REDDIT", "X", "LINKEDIN"];
  return platforms.map((platform) => {
    const rows = grouped.filter((row) => row.platform === platform);
    const sum = (stage: EngagementStage) =>
      rows.find((row) => row.stage === stage)?._sum.count ?? 0;
    return {
      platform,
      engagements: sum("ENGAGEMENT"),
      signups: sum("SIGNUP"),
    };
  });
}
