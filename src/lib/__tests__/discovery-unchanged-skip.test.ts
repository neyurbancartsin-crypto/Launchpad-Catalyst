import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentDTO, CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";

// A separate mock setup, isolated from the other discovery test files, to
// exercise "don't re-spend AI calls on unchanged posts/conversations".
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

function makePost(overrides: Partial<PostDTO> = {}): PostDTO {
  return {
    externalId: "post-1",
    communityExternalId: "community-1",
    title: "Same title",
    body: "Same body",
    author: "someone",
    url: "https://example.com/post-1",
    upvotes: 5,
    commentCount: 2,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDemoData: false,
    ...overrides,
  };
}

function makeComment(overrides: Partial<CommentDTO> = {}): CommentDTO {
  return {
    externalId: "comment-1",
    parentExternalId: null,
    postExternalId: "post-1",
    author: "commenter",
    body: "a comment",
    upvotes: 0,
    depth: 0,
    isOp: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeAdapter(config: {
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
    discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("community-1")]),
    searchPosts: config.searchPosts,
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: config.getComments ?? vi.fn().mockResolvedValue([]),
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
}

const existingOpportunityRow = {
  id: "existing-opp-id",
  title: "Same title",
  content: "Same body",
  upvotes: 5,
  commentCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.communityUpsert.mockImplementation(
    async ({ create }: { create: { externalId: string } }) => ({ id: `row-${create.externalId}` }),
  );
  prismaMocks.opportunityUpsert.mockImplementation(
    async ({ create }: { create: { externalPostId: string } }) => ({
      id: `opp-${create.externalPostId}`,
      ...create,
    }),
  );
  prismaMocks.conversationUpsert.mockResolvedValue({});
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn().mockResolvedValue(fakeAssessment),
    analyzeConversation: vi.fn().mockResolvedValue([]),
  });
});

describe("syncOpportunities - skip AI re-analysis for unchanged posts", () => {
  it("reuses the stored opportunity and never calls scoreOpportunity when the post is unchanged", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(existingOpportunityRow);
    const adapter = makeAdapter({ searchPosts: vi.fn().mockResolvedValue([makePost()]) });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.scoreOpportunity).not.toHaveBeenCalled();
    expect(prismaMocks.opportunityUpsert).not.toHaveBeenCalled();
    expect(result.discovered).toBe(0);
    expect(result.updated).toBe(1);
  });

  it("re-scores and re-upserts when the post content has changed", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(existingOpportunityRow);
    const adapter = makeAdapter({
      searchPosts: vi.fn().mockResolvedValue([makePost({ title: "A brand new title" })]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.scoreOpportunity).toHaveBeenCalledTimes(1);
    expect(prismaMocks.opportunityUpsert).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(1);
    expect(result.discovered).toBe(0);
  });

  it("scores a genuinely new post normally", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(null);
    const adapter = makeAdapter({ searchPosts: vi.fn().mockResolvedValue([makePost()]) });
    mockGetAdapter.mockReturnValue(adapter);

    const result = await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.scoreOpportunity).toHaveBeenCalledTimes(1);
    expect(result.discovered).toBe(1);
    expect(result.updated).toBe(0);
  });
});

describe("syncOpportunities - conversations are persisted without AI analysis", () => {
  const storedComments = [
    {
      id: "comment-1",
      parentId: null,
      author: "commenter",
      body: "a comment",
      upvotes: 0,
      depth: 0,
      isOp: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("skips the write entirely when the comment set is unchanged (never calls analyzeConversation either way)", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(null);
    prismaMocks.conversationFindUnique.mockResolvedValue({ comments: storedComments });
    const adapter = makeAdapter({
      searchPosts: vi.fn().mockResolvedValue([makePost()]),
      getComments: vi.fn().mockResolvedValue([makeComment()]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.analyzeConversation).not.toHaveBeenCalled();
    expect(prismaMocks.conversationUpsert).not.toHaveBeenCalled();
  });

  it("persists a new comment set without calling analyzeConversation", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(null);
    prismaMocks.conversationFindUnique.mockResolvedValue(null);
    const adapter = makeAdapter({
      searchPosts: vi.fn().mockResolvedValue([makePost()]),
      getComments: vi.fn().mockResolvedValue([makeComment()]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.analyzeConversation).not.toHaveBeenCalled();
    expect(prismaMocks.conversationUpsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMocks.conversationUpsert.mock.calls[0][0];
    expect(upsertArgs.create).not.toHaveProperty("analysis");
  });

  it("persists a changed comment set and clears any prior analysis, without calling analyzeConversation", async () => {
    prismaMocks.opportunityFindUnique.mockResolvedValue(null);
    prismaMocks.conversationFindUnique.mockResolvedValue({
      comments: [{ ...storedComments[0], body: "a different, older comment" }],
    });
    const adapter = makeAdapter({
      searchPosts: vi.fn().mockResolvedValue([makePost()]),
      getComments: vi.fn().mockResolvedValue([makeComment()]),
    });
    mockGetAdapter.mockReturnValue(adapter);

    await syncOpportunities(project, icp);

    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.analyzeConversation).not.toHaveBeenCalled();
    expect(prismaMocks.conversationUpsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMocks.conversationUpsert.mock.calls[0][0];
    // The comment set moved under it, so any previously saved analysis is
    // now stale and must be cleared rather than left mismatched.
    expect(upsertArgs.update.analysis).toBeDefined();
  });
});
