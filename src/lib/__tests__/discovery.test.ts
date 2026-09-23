import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";
import { PlatformRateLimitError } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";

const { mockGetAdapter, mockGetAIProvider, prismaMocks } = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockGetAIProvider: vi.fn(),
  prismaMocks: {
    communityUpsert: vi.fn(),
    opportunityFindUnique: vi.fn(),
    opportunityUpsert: vi.fn(),
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
    conversation: { upsert: prismaMocks.conversationUpsert },
  },
}));

vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: mockGetAdapter,
  SUPPORTED_PLATFORMS: ["GITHUB"],
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

// Imported after the mocks above so discovery.ts picks up the mocked modules.
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

const project = { id: "project-1", competitors: "ngrok, hookdeck" } as unknown as SaaSProject;
const icp = {
  searchTopics: ["webhook debugging", "inspect payload"],
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

function makeCommunity(externalId: string, topics: string[]): CommunityDTO {
  return {
    externalId,
    name: externalId,
    url: `https://example.com/${externalId}`,
    description: "",
    memberCount: 10,
    selfPromoRules: "moderate",
    topics,
    isDemoData: false,
  };
}

function makePost(externalId: string, communityExternalId: string): PostDTO {
  return {
    externalId,
    communityExternalId,
    title: "Test issue",
    body: "Test body",
    author: "someone",
    url: `https://example.com/${externalId}`,
    upvotes: 0,
    commentCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDemoData: false,
  };
}

function makeFakeAdapter(config: {
  maxCommunitiesPerSync?: number;
  discoverCommunities: PlatformAdapter["discoverCommunities"];
  searchPosts: PlatformAdapter["searchPosts"];
}): PlatformAdapter {
  return {
    platform: "GITHUB",
    maxCommunitiesPerSync: config.maxCommunitiesPerSync,
    getConnectionStatus: vi.fn().mockResolvedValue({
      platform: "GITHUB",
      status: "CONNECTED",
      message: "ok",
      isDemoData: false,
    }),
    discoverCommunities: config.discoverCommunities,
    searchPosts: config.searchPosts,
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: vi.fn().mockResolvedValue([]),
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.communityUpsert.mockImplementation(async ({ create }: { create: { externalId: string } }) => ({
    id: `row-${create.externalId}`,
  }));
  prismaMocks.opportunityFindUnique.mockResolvedValue(null);
  prismaMocks.opportunityUpsert.mockImplementation(
    async ({ create }: { create: { externalPostId: string } }) => ({ id: `opp-${create.externalPostId}` }),
  );
  prismaMocks.conversationUpsert.mockResolvedValue({});
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn().mockResolvedValue(fakeAssessment),
    analyzeConversation: vi.fn().mockResolvedValue([]),
  });
});

describe("syncOpportunities - GitHub search budget and error handling", () => {
  it("searches only the most ICP-relevant communities when the adapter declares a cap", async () => {
    const searchPosts = vi.fn().mockResolvedValue([]);
    const adapter = makeFakeAdapter({
      maxCommunitiesPerSync: 2,
      discoverCommunities: vi.fn().mockResolvedValue([
        makeCommunity("low", ["totally unrelated"]),
        makeCommunity("high", ["webhook debugging", "inspect payload"]),
        makeCommunity("medium", ["webhook debugging"]),
      ]),
      searchPosts,
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    const searchedIds = searchPosts.mock.calls.map((call) => call[0]);
    expect(searchedIds).toHaveLength(2);
    expect(searchedIds).toEqual(expect.arrayContaining(["high", "medium"]));
    expect(searchedIds).not.toContain("low");
  });

  it("searches every discovered community when the adapter declares no cap", async () => {
    const searchPosts = vi.fn().mockResolvedValue([]);
    const adapter = makeFakeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([
        makeCommunity("a", ["x"]),
        makeCommunity("b", ["y"]),
        makeCommunity("c", ["z"]),
      ]),
      searchPosts,
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    expect(searchPosts).toHaveBeenCalledTimes(3);
  });

  it("stops searching further communities on a rate limit but keeps results already synced", async () => {
    const searchPosts = vi.fn(async (communityExternalId: string) => {
      if (communityExternalId === "first") return [makePost("post-1", "first")];
      if (communityExternalId === "second") {
        throw new PlatformRateLimitError("rate limited", new Date("2026-01-01T00:01:00Z"));
      }
      return [makePost("post-3", "third")];
    });
    const adapter = makeFakeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([
        makeCommunity("first", ["a"]),
        makeCommunity("second", ["a"]),
        makeCommunity("third", ["a"]),
      ]),
      searchPosts,
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    // The loop must break, not continue, once GitHub says it's rate limited.
    expect(searchPosts).toHaveBeenCalledTimes(2);
    expect(searchPosts).not.toHaveBeenCalledWith("third", expect.anything());

    // Whatever synced before the rate limit was hit must not be discarded.
    expect(result.discovered).toBe(1);
    expect(result.perPlatform[0]).toMatchObject({ platform: "GITHUB", opportunities: 1 });
    expect(result.perPlatform[0].error).toBeUndefined();
  });

  it("skips a single community that fails for a non-rate-limit reason and continues with the rest", async () => {
    const searchPosts = vi.fn(async (communityExternalId: string) => {
      if (communityExternalId === "broken") throw new Error("404 Not Found");
      return [makePost("post-ok", "ok")];
    });
    const adapter = makeFakeAdapter({
      discoverCommunities: vi.fn().mockResolvedValue([
        makeCommunity("broken", ["a"]),
        makeCommunity("ok", ["a"]),
      ]),
      searchPosts,
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    expect(searchPosts).toHaveBeenCalledTimes(2);
    expect(result.discovered).toBe(1);
    expect(result.perPlatform[0]).toMatchObject({ platform: "GITHUB", opportunities: 1 });
    expect(result.perPlatform[0].error).toBeUndefined();
  });
});
