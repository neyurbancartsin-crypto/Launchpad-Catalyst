import type { ICP, Platform, SaaSProject } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdapter, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import { getAIProvider } from "@/lib/ai/registry";
import type { ProblemMapEntry } from "@/lib/ai/types";

/**
 * The core discovery pipeline (PRD s8-s12, s32):
 *   communities -> posts -> comments -> conversation analysis -> scoring
 *
 * Runs through the adapter interface only, so it is identical for demo
 * fixtures and for a live platform API.
 */

function problemKeywordsFrom(icp: ICP): string[] {
  const map = (icp.problemMap as unknown as ProblemMapEntry[]) ?? [];
  return [
    ...map.map((entry) => entry.problem),
    ...map.flatMap((entry) => entry.relatedProblems),
    ...icp.painPoints,
  ];
}

export interface SyncSummary {
  discovered: number;
  updated: number;
  perPlatform: {
    platform: Platform;
    opportunities: number;
    /** Set when this platform could not be reached; never silently swallowed. */
    error?: string;
  }[];
}

export async function syncOpportunities(
  project: SaaSProject,
  icp: ICP,
): Promise<SyncSummary> {
  const competitors = project.competitors
    .split(/[,\n;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const icpKeywords = [...icp.searchTopics, ...icp.roles];
  const problemKeywords = problemKeywordsFrom(icp);

  let discovered = 0;
  let updated = 0;
  const perPlatform: SyncSummary["perPlatform"] = [];

  for (const platform of SUPPORTED_PLATFORMS) {
    try {
      const result = await syncPlatform({
        platform,
        project,
        icp,
        icpKeywords,
        problemKeywords,
        competitors,
      });
      discovered += result.discovered;
      updated += result.updated;
      perPlatform.push({ platform, opportunities: result.count });
    } catch (error) {
      // One unreachable platform must not abort discovery for the others,
      // and it must never be reported as "no opportunities found".
      perPlatform.push({
        platform,
        opportunities: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { discovered, updated, perPlatform };
}

async function syncPlatform(args: {
  platform: Platform;
  project: SaaSProject;
  icp: ICP;
  icpKeywords: string[];
  problemKeywords: string[];
  competitors: string[];
}): Promise<{ discovered: number; updated: number; count: number }> {
  const { platform, project, icp, icpKeywords, problemKeywords, competitors } =
    args;
  const ai = getAIProvider();

  let discovered = 0;
  let updated = 0;
  let count = 0;

  {
    const adapter = getAdapter(platform);
    const status = await adapter.getConnectionStatus();

    // Never fabricate results for a platform that cannot serve them.
    if (status.status === "ERROR") {
      throw new Error(status.message);
    }

    const communities = await adapter.discoverCommunities({
      keywords: icp.searchTopics,
      intentSignals: icp.intentSignals,
    });

    for (const community of communities) {
      const communityRow = await prisma.community.upsert({
        where: {
          projectId_platform_externalId: {
            projectId: project.id,
            platform,
            externalId: community.externalId,
          },
        },
        create: {
          projectId: project.id,
          platform,
          externalId: community.externalId,
          name: community.name,
          url: community.url,
          description: community.description,
          memberCount: community.memberCount,
          relevanceScore: relevanceOf(community.topics, icp.searchTopics),
          selfPromoRules: community.selfPromoRules,
          isDemoData: community.isDemoData,
        },
        update: {
          name: community.name,
          url: community.url,
          description: community.description,
          memberCount: community.memberCount,
          relevanceScore: relevanceOf(community.topics, icp.searchTopics),
          selfPromoRules: community.selfPromoRules,
          isDemoData: community.isDemoData,
        },
      });

      const posts = await adapter.searchPosts(community.externalId, {
        keywords: icp.searchTopics,
        intentSignals: icp.intentSignals,
      });

      for (const post of posts) {
        const assessment = await ai.scoreOpportunity({
          title: post.title,
          content: post.body,
          communityName: community.name,
          communityTopics: community.topics,
          selfPromoRules: community.selfPromoRules,
          upvotes: post.upvotes,
          commentCount: post.commentCount,
          postedAt: post.createdAt,
          icpKeywords,
          problemKeywords,
          intentSignals: icp.intentSignals,
          productCategory: icp.productCategory,
          competitors,
        });

        const existing = await prisma.opportunity.findUnique({
          where: {
            projectId_platform_externalPostId: {
              projectId: project.id,
              platform,
              externalPostId: post.externalId,
            },
          },
          select: { id: true },
        });

        const opportunity = await prisma.opportunity.upsert({
          where: {
            projectId_platform_externalPostId: {
              projectId: project.id,
              platform,
              externalPostId: post.externalId,
            },
          },
          create: {
            projectId: project.id,
            communityId: communityRow.id,
            platform,
            externalPostId: post.externalId,
            sourceUrl: post.url,
            title: post.title,
            content: post.body,
            author: post.author,
            communityName: community.name,
            upvotes: post.upvotes,
            commentCount: post.commentCount,
            postedAt: post.createdAt,
            isDemoData: post.isDemoData,
            ...assessment,
          },
          update: {
            // Re-scoring refreshes the assessment; founder-owned status is left alone.
            sourceUrl: post.url,
            title: post.title,
            content: post.body,
            upvotes: post.upvotes,
            commentCount: post.commentCount,
            isDemoData: post.isDemoData,
            ...assessment,
          },
        });

        if (existing) updated += 1;
        else discovered += 1;
        count += 1;

        await syncConversation(
          opportunity.id,
          platform,
          post.externalId,
          post.body,
          icpKeywords,
          icp.intentSignals,
        );
      }
    }
  }

  return { discovered, updated, count };
}

/**
 * Retrieves and analyses the comment thread. This layer is a core MVP
 * requirement (PRD s10, s32), not an optional enhancement.
 */
async function syncConversation(
  opportunityId: string,
  platform: Platform,
  externalPostId: string,
  parentContent: string,
  icpKeywords: string[],
  intentSignals: string[],
): Promise<void> {
  const adapter = getAdapter(platform);
  const comments = await adapter.getComments(externalPostId);
  if (comments.length === 0) return;

  const ai = getAIProvider();
  const analysis = await ai.analyzeConversation({
    postTitle: "",
    postBody: parentContent,
    comments: comments.map((comment) => ({
      externalId: comment.externalId,
      author: comment.author,
      body: comment.body,
      upvotes: comment.upvotes,
      isOp: comment.isOp,
    })),
    icpKeywords,
    intentSignals,
  });

  const serialised = comments.map((comment) => ({
    id: comment.externalId,
    parentId: comment.parentExternalId,
    author: comment.author,
    body: comment.body,
    upvotes: comment.upvotes,
    depth: comment.depth,
    isOp: comment.isOp,
    createdAt: comment.createdAt.toISOString(),
  }));

  await prisma.conversation.upsert({
    where: { opportunityId },
    create: {
      opportunityId,
      parentContent,
      comments: serialised,
      analysis: analysis as unknown as object,
    },
    update: {
      parentContent,
      comments: serialised,
      analysis: analysis as unknown as object,
    },
  });
}

function relevanceOf(communityTopics: string[], searchTopics: string[]): number {
  if (searchTopics.length === 0) return 50;
  const haystack = communityTopics.join(" ").toLowerCase();
  const hits = searchTopics.filter((topic) =>
    haystack.includes(topic.toLowerCase()),
  ).length;
  // A community matching two ICP topics is already a strong signal.
  return Math.min(100, 40 + Math.round((hits / 2) * 60));
}
