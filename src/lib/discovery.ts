import { Prisma, type ICP, type Platform, type SaaSProject } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdapter, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import {
  PlatformRateLimitError,
  type ConnectionStatus,
  type PlatformAdapter,
} from "@/lib/adapters/types";
import { getAIProvider } from "@/lib/ai/registry";
import type { KeywordSynonymEntry, ProblemMapEntry } from "@/lib/ai/types";
import {
  buildSearchStrategy,
  matchesNegativeKeyword,
  type BuiltSearchStrategy,
} from "@/lib/search/build-query";

/**
 * The core discovery pipeline (PRD s8-s12, s32):
 *   communities -> posts -> comments -> deterministic scoring
 *
 * Runs through the adapter interface only, so it is identical for demo
 * fixtures and for a live platform API. Conversation *analysis* (AI) is
 * deliberately not part of this pipeline — comments are retrieved and
 * persisted here, but analysing them is an explicit, user-triggered action
 * (see `analyzeConversationAction`) so a sync of N opportunities never
 * spends N AI calls on threads nobody may ever look at.
 */

/** How one platform's sync run went, for founder-facing reporting. */
export type PlatformSyncStatus =
  | "OK"
  | "EMPTY"
  | "RATE_LIMITED"
  | "API_ERROR"
  | "DB_ERROR";

function problemKeywordsFrom(icp: ICP): string[] {
  const map = (icp.problemMap as unknown as ProblemMapEntry[]) ?? [];
  return [
    ...map.map((entry) => entry.problem),
    ...map.flatMap((entry) => entry.relatedProblems),
    ...icp.painPoints,
  ];
}

/** Builds the deterministic search strategy (positive/synonym-expanded/negative terms) for one ICP. */
function searchStrategyFrom(icp: ICP): BuiltSearchStrategy {
  return buildSearchStrategy({
    positiveKeywords: icp.positiveKeywords,
    keywordSynonyms: (icp.keywordSynonyms as unknown as KeywordSynonymEntry[]) ?? [],
    negativeKeywords: icp.negativeKeywords,
    intentSignals: icp.intentSignals,
    problemMap: (icp.problemMap as unknown as ProblemMapEntry[]) ?? [],
    buyingTriggers: icp.buyingTriggers,
    searchTopics: icp.searchTopics,
  });
}

/**
 * Classifies an unexpected error as a database failure (a Prisma error
 * class) or a platform/API failure (everything else) — so the summary can
 * tell the founder which layer actually broke instead of one generic
 * message for both.
 */
function classifySyncError(
  error: unknown,
): { status: "API_ERROR" | "DB_ERROR"; message: string } {
  const message = error instanceof Error ? error.message : "Unknown error";
  const isDbError =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError;
  return { status: isDbError ? "DB_ERROR" : "API_ERROR", message };
}

export interface SyncSummary {
  discovered: number;
  updated: number;
  perPlatform: {
    platform: Platform;
    opportunities: number;
    status: PlatformSyncStatus;
    /** Set only when the founder needs to know something went wrong; never set for EMPTY or a partial-success RATE_LIMITED. */
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

  // Deterministic: expands synonyms, caps size, applies negative terms —
  // no AI, computed once per sync rather than per platform/post.
  const strategy = searchStrategyFrom(icp);
  const icpKeywords = [...strategy.positiveTerms, ...icp.roles];
  const problemKeywords = problemKeywordsFrom(icp);

  let discovered = 0;
  let updated = 0;
  const perPlatform: SyncSummary["perPlatform"] = [];

  // Resolve every platform's adapter and connection status once, up front —
  // both so `syncPlatform` doesn't re-fetch it a second time (real for a
  // live adapter, e.g. GitHub's rate-limit check), and so the demo/live
  // decision below sees one consistent snapshot across all platforms.
  const resolved = await Promise.all(
    SUPPORTED_PLATFORMS.map(async (platform) => {
      const adapter = getAdapter(platform);
      const status = await adapter.getConnectionStatus();
      return { platform, adapter, status };
    }),
  );
  const anyLive = resolved.some((r) => r.status.status === "CONNECTED");

  for (const { platform, adapter, status } of resolved) {
    // Once at least one platform is genuinely connected, leave mock/demo
    // platforms out of discovery entirely rather than blending bundled
    // fixtures into a founder's real opportunity list. With nothing
    // connected yet, every platform stays in the existing demo experience —
    // that case is unchanged.
    if (anyLive && status.status === "DEMO") {
      perPlatform.push({ platform, opportunities: 0, status: "EMPTY" });
      continue;
    }

    try {
      const result = await syncPlatform({
        platform,
        adapter,
        status,
        project,
        icp,
        strategy,
        icpKeywords,
        problemKeywords,
        competitors,
      });
      discovered += result.discovered;
      updated += result.updated;
      perPlatform.push({
        platform,
        opportunities: result.count,
        status: result.status,
        error: result.error,
      });
    } catch (error) {
      // Safety net only: `syncPlatform` is written to never throw for an
      // expected failure mode (rate limit, API error, DB error) — it
      // returns a status instead. This catch exists purely so a genuinely
      // unforeseen exception still can't take the other platforms down
      // with it, and is still reported accurately.
      const classified = classifySyncError(error);
      perPlatform.push({
        platform,
        opportunities: 0,
        status: classified.status,
        error: classified.message,
      });
    }
  }

  return { discovered, updated, perPlatform };
}

interface PlatformSyncResult {
  discovered: number;
  updated: number;
  count: number;
  status: PlatformSyncStatus;
  error?: string;
}

async function syncPlatform(args: {
  platform: Platform;
  adapter: PlatformAdapter;
  status: ConnectionStatus;
  project: SaaSProject;
  icp: ICP;
  strategy: BuiltSearchStrategy;
  icpKeywords: string[];
  problemKeywords: string[];
  competitors: string[];
}): Promise<PlatformSyncResult> {
  const {
    platform,
    adapter,
    status,
    project,
    icp,
    strategy,
    icpKeywords,
    problemKeywords,
    competitors,
  } = args;
  const ai = getAIProvider();

  // Never fabricate results for a platform that cannot serve them.
  if (status.status === "ERROR") {
    return { discovered: 0, updated: 0, count: 0, status: "API_ERROR", error: status.message };
  }

  let communities;
  try {
    communities = await adapter.discoverCommunities({
      keywords: strategy.positiveTerms,
      intentSignals: strategy.intentSignals,
    });
  } catch (error) {
    if (error instanceof PlatformRateLimitError) {
      return { discovered: 0, updated: 0, count: 0, status: "RATE_LIMITED", error: error.message };
    }
    const classified = classifySyncError(error);
    return { discovered: 0, updated: 0, count: 0, status: classified.status, error: classified.message };
  }

  let communityEntries: {
    community: (typeof communities)[number];
    communityRow: Awaited<ReturnType<typeof prisma.community.upsert>>;
    relevanceScore: number;
  }[];
  try {
    communityEntries = [];
    for (const community of communities) {
      const relevanceScore = relevanceOf(community.topics, strategy.positiveTerms);
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
          relevanceScore,
          selfPromoRules: community.selfPromoRules,
          isDemoData: community.isDemoData,
        },
        update: {
          name: community.name,
          url: community.url,
          description: community.description,
          memberCount: community.memberCount,
          relevanceScore,
          selfPromoRules: community.selfPromoRules,
          isDemoData: community.isDemoData,
        },
      });
      communityEntries.push({ community, communityRow, relevanceScore });
    }
  } catch (error) {
    const classified = classifySyncError(error);
    return { discovered: 0, updated: 0, count: 0, status: classified.status, error: classified.message };
  }

  // Some adapters' search endpoints have a much tighter rate limit than
  // "one search per discovered community" can stay inside (see
  // `maxCommunitiesPerSync`). Those adapters are searched only for their
  // most ICP-relevant communities instead of blindly working through every
  // one. Adapters that don't declare it (Hacker News, Stack Overflow) are
  // unaffected: every discovered community is searched, exactly as before.
  const communitiesToSearch = adapter.maxCommunitiesPerSync
    ? [...communityEntries]
        .sort(
          (a, b) =>
            // Relevance decides order first; member/star count only
            // breaks ties (very common once many communities fall back to
            // the same baseline score), never overrides a real relevance
            // difference.
            b.relevanceScore - a.relevanceScore ||
            (b.community.memberCount ?? 0) - (a.community.memberCount ?? 0),
        )
        .slice(0, adapter.maxCommunitiesPerSync)
    : communityEntries;

  let discovered = 0;
  let updated = 0;
  let count = 0;
  // Set once a rate limit is hit; stops all further requests to this
  // platform for the rest of the run while keeping everything synced so far.
  let stopped: { message: string } | null = null;
  // The most recent non-fatal failure (one community or one post), kept so
  // a platform that ends up with zero results can still say *why* instead
  // of looking identical to "genuinely nothing found".
  let lastNonFatal: { status: "API_ERROR" | "DB_ERROR"; message: string } | null = null;

  for (const { community, communityRow } of communitiesToSearch) {
    if (stopped) break;

    let posts;
    try {
      posts = await adapter.searchPosts(community.externalId, {
        keywords: strategy.positiveTerms,
        intentSignals: strategy.intentSignals,
      });
    } catch (error) {
      if (error instanceof PlatformRateLimitError) {
        // Respect the limit rather than hammer it further: stop searching
        // more communities this run, but keep everything already synced
        // instead of discarding it.
        console.warn(
          `[discovery] ${platform} search rate-limited` +
            (error.retryAt ? ` (resets ${error.retryAt.toISOString()})` : "") +
            `; stopping further ${platform} searches this run. ${discovered + updated} opportunities already synced are kept.`,
        );
        stopped = { message: error.message };
        break;
      }
      // One repository/community failing for another reason (deleted,
      // private, a transient API error) shouldn't sink the rest of the sync.
      const classified = classifySyncError(error);
      console.warn(
        `[discovery] ${platform} search failed for ${community.externalId}, skipping this community: ${classified.message}`,
      );
      lastNonFatal = classified;
      continue;
    }

    // Conservative, deterministic: drop only posts containing an exact
    // negative phrase, before they ever reach scoring or persistence.
    const filteredPosts = strategy.negativeTerms.length
      ? posts.filter((post) => !matchesNegativeKeyword(`${post.title} ${post.body}`, strategy.negativeTerms))
      : posts;

    for (const post of filteredPosts) {
      try {
        const existing = await prisma.opportunity.findUnique({
          where: {
            projectId_platform_externalPostId: {
              projectId: project.id,
              platform,
              externalPostId: post.externalId,
            },
          },
        });

        // Nothing about this post has changed since it was last scored —
        // reuse the stored assessment instead of recomputing for identical
        // content on every refresh.
        const unchanged =
          !!existing &&
          existing.title === post.title &&
          existing.content === post.body &&
          existing.upvotes === post.upvotes &&
          existing.commentCount === post.commentCount;

        let opportunity: NonNullable<typeof existing>;

        if (unchanged) {
          opportunity = existing;
          updated += 1;
        } else {
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
            intentSignals: strategy.intentSignals,
            productCategory: icp.productCategory,
            competitors,
          });

          opportunity = await prisma.opportunity.upsert({
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
        }
        count += 1;

        await syncConversation(opportunity.id, platform, post.externalId, post.body);
      } catch (error) {
        if (error instanceof PlatformRateLimitError) {
          console.warn(
            `[discovery] ${platform} rate-limited while syncing a post` +
              (error.retryAt ? ` (resets ${error.retryAt.toISOString()})` : "") +
              `; stopping further ${platform} requests this run. ${discovered + updated} opportunities already synced are kept.`,
          );
          stopped = { message: error.message };
          break;
        }
        // One bad post (a malformed response, a transient DB hiccup on its
        // upsert, a single comment-fetch failure) must not discard every
        // other post already synced for this platform.
        const classified = classifySyncError(error);
        console.warn(
          `[discovery] ${platform} failed to sync post ${post.externalId}, skipping: ${classified.message}`,
        );
        lastNonFatal = classified;
        continue;
      }
    }
  }

  if (stopped) {
    return {
      discovered,
      updated,
      count,
      status: "RATE_LIMITED",
      // Only surface the message when nothing was salvaged — a rate limit
      // that still left the founder with real results isn't a failure.
      error: count > 0 ? undefined : stopped.message,
    };
  }
  if (count > 0) {
    return { discovered, updated, count, status: "OK" };
  }
  if (lastNonFatal) {
    return { discovered, updated, count: 0, status: lastNonFatal.status, error: lastNonFatal.message };
  }
  return { discovered, updated, count: 0, status: "EMPTY" };
}

/**
 * Retrieves the comment thread and persists it. Deliberately does NOT call
 * AI — comment-level analysis is an explicit, user-triggered action (see
 * `analyzeConversationAction` in `src/actions/opportunities.actions.ts`),
 * not something every discovery run pays for automatically regardless of
 * whether the founder ever opens the post.
 */
async function syncConversation(
  opportunityId: string,
  platform: Platform,
  externalPostId: string,
  parentContent: string,
): Promise<void> {
  const adapter = getAdapter(platform);
  const comments = await adapter.getComments(externalPostId);
  if (comments.length === 0) return;

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

  const existing = await prisma.conversation.findUnique({
    where: { opportunityId },
    select: { comments: true },
  });

  // Same comment set as last time (same ids/bodies/order): nothing new to
  // persist, and any prior AI analysis is still valid — leave it alone.
  if (existing && JSON.stringify(existing.comments) === JSON.stringify(serialised)) {
    return;
  }

  await prisma.conversation.upsert({
    where: { opportunityId },
    create: {
      opportunityId,
      parentContent,
      comments: serialised,
    },
    update: {
      parentContent,
      comments: serialised,
      // The comment set changed under it, so any previously saved AI
      // analysis no longer matches — clear it rather than leave a stale
      // analysis displayed against different comments. The founder can
      // re-run "Analyze conversation" to get a fresh one.
      analysis: Prisma.DbNull,
    },
  });
}

/**
 * How well a discovered community's topics line up with the ICP's search
 * topics — used to decide which communities are worth searching first.
 * Matches at the word level, not whole-phrase: a community's own topics are
 * almost always short, single-word or hyphenated tags, and a full 3-4 word
 * ICP phrase essentially never appears verbatim inside one, regardless of
 * the product or platform. Generic across any project's search topics.
 */
function relevanceOf(communityTopics: string[], searchTopics: string[]): number {
  if (searchTopics.length === 0) return 50;

  const haystack = communityTopics.join(" ").toLowerCase();
  const words = [
    ...new Set(
      searchTopics
        .flatMap((topic) => topic.toLowerCase().split(/\s+/))
        .filter((word) => word.length > 2),
    ),
  ];
  if (words.length === 0) return 50;

  const hits = words.filter((word) => haystack.includes(word)).length;
  // Scales with how much of the ICP's vocabulary actually shows up, rather
  // than requiring an entire phrase to match verbatim.
  return Math.min(100, 40 + Math.round((hits / words.length) * 60));
}
