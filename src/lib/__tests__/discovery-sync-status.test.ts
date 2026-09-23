import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";

// Isolated mock setup covering the structured per-platform sync status
// (OK/EMPTY/RATE_LIMITED/API_ERROR/DB_ERROR), per-post failure isolation,
// and the removal of automatic AI conversation analysis from discovery.
const { mockGetAdapter, mockGetAIProvider, prismaMocks } = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockGetAIProvider: vi.fn(),
  prismaMocks: {
    communityUpsert: vi.fn(),
    opportunityFindUnique: vi.fn(),
    opportunityUpsert: vi.fn(),
    conversationFindUnique: vi.fn(),
    conversationUpsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    community: { upsert: prismaMocks.communityUpsert },
    opportunity: {
      findUnique: prismaMocks.opportunityFindUnique,
      upsert: prismaMocks.opportunityUpsert,
    },
    conversation: {
      findUnique: prismaMocks.conversationFindUnique,
      upsert: prismaMocks.conversationUpsert,
    },
  },
}));

vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: mockGetAdapter,
  SUPPORTED_PLATFORMS: ["GITHUB"],
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

const { syncOpportunities } = await import("../discovery");

const fakeAssessment = {
  icpScore: 50,
  problemScore: 50,
  intentScore: 50,
  recencyScore: 50,
  relevanceScore: 50,
  engagementScore: 50,
  opportunityScore: 50,
  priorityBand: "REVIEW",
  promotionRisk: "LOW",
  promotionRiskReason: "test",
  recommendedAction: "Engage",
  actionRationale: "test",
};

const project = { id: "project-1", competitors: "none" } as unknown as SaaSProject;
const icp = {
  searchTopics: ["topic one"],
  roles: [],
  problemMap: [],
  painPoints: [],
  intentSignals: [],
  buyingTriggers: [],
  positiveKeywords: [],
  keywordSynonyms: [],
  negativeKeywords: [],
  productCategory: "Developer tools",
} as unknown as ICP;

function makeCommunity(externalId: string): CommunityDTO {
  return {
    externalId,
    name: externalId,
    url: `https://example.com/${externalId}`,
    description: "",
    memberCount: 10,
    selfPromoRules: "moderate",
    topics: ["topic one"],
    isDemoData: false,
  };
}

function makePost(externalId: string): PostDTO {
  return {
    externalId,
    communityExternalId: "community-1",
    title: `Title ${externalId}`,
    body: "Test body",
    author: "someone",
    url: `https://example.com/${externalId}`,
    upvotes: 0,
    commentCount: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDemoData: false,
  };
}

function makeAdapter(config: {
  discoverCommunities: PlatformAdapter["discoverCommunities"];
  searchPosts: PlatformAdapter["searchPosts"];
  getComments?: PlatformAdapter["getComments"];
}): PlatformAdapter {
  return {
    platform: "GITHUB",
    getConnectionStatus: vi.fn().mockResolvedValue({
      platform: "GITHUB",
      status: "CONNECTED",
      message: "ok",
      isDemoData: false,
    }),
    discoverCommunities: config.discoverCommunities,
    searchPosts: config.searchPosts,
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: config.getComments ?? vi.fn().mockResolvedValue([]),
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.communityUpsert.mockImplementation(
    async ({ create }: { create: { externalId: string } }) => ({ id: `row-${create.externalId}` }),
  );
  prismaMocks.opportunityFindUnique.mockResolvedValue(null);
  prismaMocks.opportunityUpsert.mockImplementation(
    async ({ create }: { create: { externalPostId: string } }) => ({ id: `opp-${create.externalPostId}` }),
  );
  prismaMocks.conversationFindUnique.mockResolvedValue(null);
  prismaMocks.conversationUpsert.mockResolvedValue({});
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn().mockResolvedValue(fakeAssessment),
    analyzeConversation: vi.fn().mockResolvedValue([]),
  });
});

describe("syncOpportunities - no automatic AI conversation analysis", () => {
  it("never calls analyzeConversation, and only resolves the AI provider once (for deterministic scoring)", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([makePost("post-1")]),
      getComments: vi.fn().mockResolvedValue([
        {
          externalId: "c1",
          parentExternalId: null,
          postExternalId: "post-1",
          author: "commenter",
          body: "a comment",
          upvotes: 0,
          depth: 0,
          isOp: false,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    // Comments are still retrieved and persisted...
    expect(prismaMocks.conversationUpsert).toHaveBeenCalledTimes(1);
    // ...but no AI call is spent analysing them, and the AI provider is
    // resolved exactly once, purely for the deterministic scoreOpportunity path.
    expect(mockGetAIProvider).toHaveBeenCalledTimes(1);
    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.analyzeConversation).not.toHaveBeenCalled();
    expect(ai.scoreOpportunity).toHaveBeenCalledTimes(1);
  });
});

describe("syncOpportunities - structured per-platform status", () => {
  it("reports EMPTY when a platform genuinely has no matching communities", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([]),
      searchPosts: vi.fn().mockResolvedValue([]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    expect(result.perPlatform[0]).toMatchObject({
      platform: "GITHUB",
      opportunities: 0,
      status: "EMPTY",
    });
    expect(result.perPlatform[0].error).toBeUndefined();
  });

  it("reports API_ERROR (not DB_ERROR) when discoverCommunities throws a plain error", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockRejectedValue(new Error("network unreachable")),
      searchPosts: vi.fn().mockResolvedValue([]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    expect(result.perPlatform[0]).toMatchObject({
      platform: "GITHUB",
      opportunities: 0,
      status: "API_ERROR",
      error: "network unreachable",
    });
  });

  it("reports DB_ERROR when a Prisma error is thrown while persisting a community", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([]),
    });
    mockGetAdapter.mockReturnValue(adapter);
    prismaMocks.communityUpsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    const result = await syncOpportunities(project, icp);

    expect(result.perPlatform[0]).toMatchObject({
      platform: "GITHUB",
      opportunities: 0,
      status: "DB_ERROR",
    });
    expect(result.perPlatform[0].error).toContain("Unique constraint failed");
  });
});

describe("syncOpportunities - per-post failure isolation", () => {
  it("one post failing to persist does not discard the other posts synced for the same platform", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([makePost("bad-post"), makePost("good-post")]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    prismaMocks.opportunityUpsert.mockImplementation(
      async ({ create }: { create: { externalPostId: string } }) => {
        if (create.externalPostId === "bad-post") {
          throw new Error("upsert failed for bad-post");
        }
        return { id: `opp-${create.externalPostId}` };
      },
    );

    const result = await syncOpportunities(project, icp);

    // The good post still made it through despite the bad one failing.
    expect(result.discovered).toBe(1);
    expect(result.perPlatform[0]).toMatchObject({
      platform: "GITHUB",
      opportunities: 1,
      status: "OK",
    });
  });
});

describe("syncOpportunities - duplicate syncs", () => {
  it("does not create a second opportunity row for the same post on a repeat sync", async () => {
    // A minimal fake upsert store, keyed the same way the real unique
    // constraint (projectId+platform+externalPostId) is: create on first
    // write, update in place afterwards — proving repeat syncs stay
    // idempotent rather than accumulating duplicate rows.
    const store = new Map<string, { id: string }>();
    prismaMocks.opportunityUpsert.mockImplementation(
      async ({
        where,
        create,
      }: {
        where: { projectId_platform_externalPostId: { externalPostId: string } };
        create: { externalPostId: string };
      }) => {
        const key = where.projectId_platform_externalPostId.externalPostId;
        const row = store.get(key) ?? { id: `opp-${create.externalPostId}` };
        store.set(key, row);
        return row;
      },
    );

    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([makePost("post-1")]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);
    await syncOpportunities(project, icp);

    expect(store.size).toBe(1);
  });
});

describe("syncOpportunities - negative-keyword filtering", () => {
  it("excludes a post matching a negative keyword before it is scored or persisted", async () => {
    const icpWithNegative = {
      ...icp,
      positiveKeywords: ["overdue invoice"],
      negativeKeywords: ["hiring"],
    } as unknown as ICP;

    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([
        { ...makePost("job-post"), title: "We're hiring a support engineer" },
        { ...makePost("real-post"), title: "How do you track overdue invoices?" },
      ]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icpWithNegative);

    // Only the genuine post was scored/persisted; the job posting never
    // reached scoreOpportunity or the opportunity upsert at all.
    expect(result.discovered).toBe(1);
    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.scoreOpportunity).toHaveBeenCalledTimes(1);
    expect(prismaMocks.opportunityUpsert).toHaveBeenCalledTimes(1);
    expect(prismaMocks.opportunityUpsert.mock.calls[0][0].create.externalPostId).toBe(
      "real-post",
    );
  });

  it("does not filter anything when there are no negative keywords", async () => {
    const adapter = makeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
      searchPosts: vi.fn().mockResolvedValue([makePost("post-1"), makePost("post-2")]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    expect(result.discovered).toBe(2);
  });
});
