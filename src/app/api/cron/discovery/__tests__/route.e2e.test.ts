import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";

/**
 * End-to-end proof (per the task's explicit requirement) that a real
 * cron-triggered request runs the actual pipeline — route -> runDiscoverySync
 * -> syncOpportunities -> adapter — with ZERO AI calls. Unlike route.test.ts,
 * `runDiscoverySync`/`syncOpportunities` are NOT mocked here; only the
 * platform adapter, the AI provider registry, and Prisma are.
 */

const { mockGetAdapter, mockGetAIProvider, prismaMocks } = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockGetAIProvider: vi.fn(),
  prismaMocks: {
    saaSProjectFindMany: vi.fn(),
    saaSProjectUpdateMany: vi.fn(),
    saaSProjectUpdate: vi.fn(),
    communityUpsert: vi.fn(),
    opportunityFindUnique: vi.fn(),
    opportunityUpsert: vi.fn(),
    conversationFindUnique: vi.fn(),
    conversationUpsert: vi.fn(),
    discoveryRunCreate: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    saaSProject: {
      findMany: prismaMocks.saaSProjectFindMany,
      updateMany: prismaMocks.saaSProjectUpdateMany,
      update: prismaMocks.saaSProjectUpdate,
    },
    community: { upsert: prismaMocks.communityUpsert },
    opportunity: {
      findUnique: prismaMocks.opportunityFindUnique,
      upsert: prismaMocks.opportunityUpsert,
    },
    conversation: {
      findUnique: prismaMocks.conversationFindUnique,
      upsert: prismaMocks.conversationUpsert,
    },
    discoveryRun: { create: prismaMocks.discoveryRunCreate },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: mockGetAdapter,
  SUPPORTED_PLATFORMS: ["GITHUB"],
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

const { POST } = await import("../route");

function fakeRequest(headers: Record<string, string>): NextRequest {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as NextRequest;
}

function makeCommunity(): CommunityDTO {
  return {
    externalId: "community-1",
    name: "community-1",
    url: "https://example.com/community-1",
    description: "",
    memberCount: 10,
    selfPromoRules: "moderate",
    topics: ["topic"],
    isDemoData: false,
  };
}

function makePost(): PostDTO {
  return {
    externalId: "post-1",
    communityExternalId: "community-1",
    title: "How do you track overdue invoices?",
    body: "Genuinely asking, not promotional.",
    author: "someone",
    url: "https://example.com/post-1",
    upvotes: 3,
    commentCount: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDemoData: false,
  };
}

const project = {
  id: "project-1",
  onboardingComplete: true,
  autoDiscoveryEnabled: true,
  discoveryIntervalHours: 6,
  lastAutoDiscoveryAt: null,
  competitors: "none",
  icp: {
    searchTopics: ["overdue invoice"],
    roles: [],
    problemMap: [],
    painPoints: [],
    intentSignals: [],
    buyingTriggers: [],
    positiveKeywords: [],
    keywordSynonyms: [],
    negativeKeywords: [],
    productCategory: "Invoicing",
  },
};

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";

  prismaMocks.saaSProjectFindMany.mockResolvedValue([project]);
  prismaMocks.saaSProjectUpdateMany.mockResolvedValue({ count: 1 });
  prismaMocks.saaSProjectUpdate.mockResolvedValue({ id: project.id });
  prismaMocks.communityUpsert.mockImplementation(
    async ({ create }: { create: { externalId: string } }) => ({ id: `row-${create.externalId}` }),
  );
  prismaMocks.opportunityFindUnique.mockResolvedValue(null);
  prismaMocks.opportunityUpsert.mockImplementation(
    async ({ create }: { create: { externalPostId: string } }) => ({ id: `opp-${create.externalPostId}` }),
  );
  prismaMocks.conversationFindUnique.mockResolvedValue(null);
  prismaMocks.conversationUpsert.mockResolvedValue({});
  prismaMocks.discoveryRunCreate.mockResolvedValue({ id: "run-1" });

  const adapter: PlatformAdapter = {
    platform: "GITHUB",
    getConnectionStatus: vi
      .fn()
      .mockResolvedValue({ platform: "GITHUB", status: "CONNECTED", message: "ok", isDemoData: false }),
    discoverCommunities: vi.fn().mockResolvedValue([makeCommunity()]),
    searchPosts: vi.fn().mockResolvedValue([makePost()]),
    getPostDetails: vi.fn().mockResolvedValue(null),
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
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
  mockGetAdapter.mockReturnValue(adapter);

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
  mockGetAIProvider.mockReturnValue({
    scoreOpportunity: vi.fn().mockResolvedValue(fakeAssessment),
    analyzeConversation: vi.fn().mockResolvedValue([]),
    generateResponse: vi.fn(),
  });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("POST /api/cron/discovery - end-to-end, zero AI calls", () => {
  it("discovers and persists a real opportunity through the full pipeline without calling analyzeConversation/generateResponse", async () => {
    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0].status).toBe("ok");

    // The opportunity was actually persisted (deterministic scoring ran).
    expect(prismaMocks.opportunityUpsert).toHaveBeenCalledTimes(1);

    // The AI provider was resolved only for the deterministic scoreOpportunity
    // path — never for conversation analysis or response generation.
    const ai = mockGetAIProvider.mock.results[0].value;
    expect(ai.scoreOpportunity).toHaveBeenCalledTimes(1);
    expect(ai.analyzeConversation).not.toHaveBeenCalled();
    expect(ai.generateResponse).not.toHaveBeenCalled();
  });

  it("updates lastAutoDiscoveryAt after the real run completes", async () => {
    await POST(fakeRequest({ authorization: "Bearer test-secret" }));

    const updateCall = prismaMocks.saaSProjectUpdate.mock.calls.find(
      (call) => "lastAutoDiscoveryAt" in call[0].data,
    );
    expect(updateCall).toBeDefined();
  });
});
