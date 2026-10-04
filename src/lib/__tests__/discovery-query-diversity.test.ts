import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";

/**
 * Covers the two invariants this feature must never violate:
 *  - Test 1 (first discovery): `syncOpportunities` still works with no
 *    `freshQueries` at all — the new third parameter is fully optional.
 *  - Test 8 (existing scoring unchanged): whatever fresh queries a cycle
 *    uses, `scoreOpportunity`'s own inputs (icpKeywords/problemKeywords)
 *    must be byte-for-byte identical to what the deterministic ICP alone
 *    would have produced — query freshness is a retrieval concern only.
 */

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

const { syncOpportunities } = await import("../discovery");

const project = { id: "project-1", competitors: "none" } as unknown as SaaSProject;
const icp = {
  positiveKeywords: ["unpaid invoice"],
  keywordSynonyms: [],
  negativeKeywords: [],
  intentSignals: ["how do i"],
  problemMap: [],
  buyingTriggers: [],
  searchTopics: [],
  supportedUseCases: [],
  roles: [],
  painPoints: [],
  productCategory: "invoicing",
} as unknown as ICP;

function makeCommunity(): CommunityDTO {
  return {
    externalId: "c",
    name: "c",
    url: "https://example.com/c",
    description: "",
    memberCount: 10,
    selfPromoRules: "moderate",
    topics: ["invoicing"],
    isDemoData: false,
  };
}

function makePost(): PostDTO {
  return {
    externalId: "post-1",
    communityExternalId: "c",
    title: "How do you handle unpaid invoices?",
    body: "Genuinely asking.",
    author: "someone",
    url: "https://example.com/post-1",
    upvotes: 1,
    commentCount: 0,
    createdAt: new Date(),
    isDemoData: false,
  };
}

let capturedSearchArgs: { keywords: string[]; intentSignals?: string[] }[] = [];

function makeAdapter(): PlatformAdapter {
  return {
    platform: "GITHUB",
    getConnectionStatus: vi
      .fn()
      .mockResolvedValue({ platform: "GITHUB", status: "CONNECTED", message: "ok", isDemoData: false }),
    discoverCommunities: vi.fn(async (query) => {
      capturedSearchArgs.push(query);
      return [makeCommunity()];
    }),
    searchPosts: vi.fn(async (_communityId, query) => {
      capturedSearchArgs.push(query);
      return [makePost()];
    }),
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: vi.fn().mockResolvedValue([]),
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
}

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

let capturedScoringArgs: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  capturedSearchArgs = [];
  capturedScoringArgs = [];
  mockGetAdapter.mockReturnValue(makeAdapter());
  prismaMocks.communityUpsert.mockResolvedValue({ id: "row-c" });
  prismaMocks.opportunityFindUnique.mockResolvedValue(null);
  prismaMocks.opportunityUpsert.mockImplementation(
    async ({ create }: { create: { externalPostId: string } }) => ({ id: `opp-${create.externalPostId}` }),
  );
  prismaMocks.conversationUpsert.mockResolvedValue({});
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn(async (input) => {
      capturedScoringArgs.push(input);
      return fakeAssessment;
    }),
  });
});

describe("syncOpportunities - Test 1: first discovery (no freshQueries)", () => {
  it("runs normally when no third argument is given at all", async () => {
    const summary = await syncOpportunities(project, icp);
    expect(summary.discovered).toBe(1);
  });

  it("runs normally when freshQueries is explicitly empty", async () => {
    const summary = await syncOpportunities(project, icp, { freshQueries: [] });
    expect(summary.discovered).toBe(1);
  });
});

describe("syncOpportunities - query diversity feeds retrieval only", () => {
  it("puts fresh queries at the front of what adapters are searched with", async () => {
    await syncOpportunities(project, icp, {
      freshQueries: ["clients delaying freelance payments", "late payment problems"],
    });

    const searchCall = capturedSearchArgs.find((c) => c.keywords.length > 0);
    expect(searchCall?.keywords[0]).toBe("clients delaying freelance payments");
    expect(searchCall?.keywords[1]).toBe("late payment problems");
  });

  it("falls back to the deterministic strategy's own terms when freshQueries is empty", async () => {
    await syncOpportunities(project, icp, { freshQueries: [] });

    const searchCall = capturedSearchArgs.find((c) => c.keywords.length > 0);
    expect(searchCall?.keywords[0]).toBe("unpaid invoice");
  });
});

// Test 8: existing scoring behavior is unchanged by query diversity.
describe("syncOpportunities - Test 8: scoring inputs are independent of freshQueries", () => {
  it("passes identical icpKeywords/problemKeywords to scoreOpportunity regardless of freshQueries", async () => {
    await syncOpportunities(project, icp, { freshQueries: [] });
    const withoutFresh = capturedScoringArgs[0];

    capturedScoringArgs = [];
    await syncOpportunities(project, icp, {
      freshQueries: ["a completely different angle nobody searched before"],
    });
    const withFresh = capturedScoringArgs[0];

    expect(withFresh.icpKeywords).toEqual(withoutFresh.icpKeywords);
    expect(withFresh.problemKeywords).toEqual(withoutFresh.problemKeywords);
    expect(withFresh.intentSignals).toEqual(withoutFresh.intentSignals);
    // And neither ever contains the fresh-only phrase.
    expect(withFresh.icpKeywords).not.toContain("a completely different angle nobody searched before");
  });
});
