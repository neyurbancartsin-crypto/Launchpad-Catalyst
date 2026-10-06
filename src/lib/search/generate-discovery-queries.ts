import type { ICP, SaaSProject } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateDeterministicDiscoveryQueries } from "./deterministic-discovery-queries";
import type { ProblemMapEntry } from "@/lib/ai/types";

/**
 * How many of the most recent discovery cycles' queries the generator sees
 * as "recently used" — bounded, not an ever-growing history. Each
 * `DiscoveryRun` row already stores only its own small query batch (see
 * schema), so this is a handful of small arrays, not a log that grows
 * without limit.
 */
const RECENT_RUNS_CONSIDERED = 3;

/**
 * Builds this cycle's fresh batch of search-angle phrases from the ICP's
 * own stored business context plus recent discovery history — reusing the
 * already-stored ICP rather than regenerating the business understanding,
 * for THIS cycle's retrieval only (never scoring — see discovery.ts). Call
 * sites: `runDiscoverySync`, shared by onboarding, "Find New Opportunities",
 * and the cron.
 *
 * Fully deterministic — no AI provider, no network call, cannot be
 * rate-limited or go down, so Gemini/Claude/OpenRouter availability never
 * affects discovery. Never throws: an unexpected data shape must not block
 * discovery entirely — callers get back an empty array and
 * `syncOpportunities` falls back to its existing deterministic query
 * strategy exactly as it did before this feature existed.
 */
export async function generateFreshQueries(
  project: SaaSProject,
  icp: ICP,
): Promise<string[]> {
  try {
    const recentRuns = await prisma.discoveryRun.findMany({
      where: { projectId: project.id },
      orderBy: { runAt: "desc" },
      take: RECENT_RUNS_CONSIDERED,
      select: { queriesUsed: true },
    });
    const recentQueries = [...new Set(recentRuns.flatMap((run) => run.queriesUsed))];

    const result = generateDeterministicDiscoveryQueries({
      productSummary: icp.productSummary,
      coreProblem: icp.coreProblem,
      primaryCustomer: icp.primaryCustomer,
      painPoints: icp.painPoints,
      problemMap: (icp.problemMap as unknown as ProblemMapEntry[]) ?? [],
      supportedUseCases: icp.supportedUseCases,
      positiveKeywords: icp.positiveKeywords,
      searchTopics: icp.searchTopics,
      recentQueries,
    });
    return result.queries.filter((q) => q.trim().length > 0);
  } catch (error) {
    console.warn(
      `[discovery] fresh query generation failed for project ${project.id}, falling back to the deterministic query strategy only: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}
