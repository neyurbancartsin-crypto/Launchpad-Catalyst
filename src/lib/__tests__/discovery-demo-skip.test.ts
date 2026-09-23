import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformAdapter } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";

// A separate mock setup from discovery.test.ts, scoped to two platforms,
// specifically to exercise the "don't mix demo platforms into a live
// founder's results" rule without touching the existing single-platform
// (GitHub-only) test suite.
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
  SUPPORTED_PLATFORMS: ["GITHUB", "HACKERNEWS"],
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
  searchTopics: [],
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

function makeAdapter(
  platform: "GITHUB" | "HACKERNEWS",
  statusKind: "CONNECTED" | "DEMO",
  discoverCommunities: PlatformAdapter["discoverCommunities"],
): PlatformAdapter {
  return {
    platform,
    getConnectionStatus: vi.fn().mockResolvedValue({
      platform,
      status: statusKind,
      message: statusKind === "DEMO" ? "Demo data" : "Connected",
      isDemoData: statusKind === "DEMO",
    }),
    discoverCommunities,
    searchPosts: vi.fn().mockResolvedValue([]),
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: vi.fn().mockResolvedValue([]),
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
  prismaMocks.conversationUpsert.mockResolvedValue({});
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn().mockResolvedValue(fakeAssessment),
    analyzeConversation: vi.fn().mockResolvedValue([]),
  });
});

describe("syncOpportunities - keeping demo platforms out of a live founder's results", () => {
  it("skips a DEMO-status platform entirely once another platform is genuinely CONNECTED", async () => {
    const githubDiscover = vi.fn().mockResolvedValue([]);
    const hnDiscover = vi.fn().mockResolvedValue([]);
    const github = makeAdapter("GITHUB", "CONNECTED", githubDiscover);
    const hackerNews = makeAdapter("HACKERNEWS", "DEMO", hnDiscover);
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? github : hackerNews,
    );

    const result = await syncOpportunities(project, icp);

    expect(githubDiscover).toHaveBeenCalledTimes(1);
    // The demo platform is never even queried, not just filtered afterward.
    expect(hnDiscover).not.toHaveBeenCalled();

    const hnSummary = result.perPlatform.find((p) => p.platform === "HACKERNEWS");
    expect(hnSummary).toMatchObject({ platform: "HACKERNEWS", opportunities: 0 });
    expect(hnSummary?.error).toBeUndefined();
  });

  it("runs every platform, including DEMO ones, when nothing is CONNECTED yet", async () => {
    const githubDiscover = vi.fn().mockResolvedValue([]);
    const hnDiscover = vi.fn().mockResolvedValue([]);
    const github = makeAdapter("GITHUB", "DEMO", githubDiscover);
    const hackerNews = makeAdapter("HACKERNEWS", "DEMO", hnDiscover);
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? github : hackerNews,
    );

    await syncOpportunities(project, icp);

    // Nothing connected yet: the existing full-demo experience is unchanged.
    expect(githubDiscover).toHaveBeenCalledTimes(1);
    expect(hnDiscover).toHaveBeenCalledTimes(1);
  });
});
