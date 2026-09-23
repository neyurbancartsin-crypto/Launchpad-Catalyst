import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireProjectWithIcp, mockGetAIProvider, prismaMocks } = vi.hoisted(() => ({
  mockRequireProjectWithIcp: vi.fn(),
  mockGetAIProvider: vi.fn(),
  prismaMocks: {
    opportunityFindFirst: vi.fn(),
    conversationUpdate: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    opportunity: { findFirst: prismaMocks.opportunityFindFirst },
    conversation: { update: prismaMocks.conversationUpdate },
  },
}));

vi.mock("@/lib/project", () => ({
  requireProjectWithIcp: mockRequireProjectWithIcp,
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { analyzeConversationAction } = await import("../opportunities.actions");
const { resetRateLimits } = await import("@/lib/rate-limit");

const project = { id: "project-1" };
const icp = { searchTopics: ["topic"], roles: ["role"], intentSignals: ["how do i"] };

const storedComment = {
  id: "c1",
  parentId: null,
  author: "a",
  body: "b",
  upvotes: 1,
  depth: 0,
  isOp: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  mockRequireProjectWithIcp.mockResolvedValue({ project, icp });
  prismaMocks.conversationUpdate.mockResolvedValue({});
});

describe("analyzeConversationAction", () => {
  it("returns an error when the opportunity is not found or not owned by this project", async () => {
    prismaMocks.opportunityFindFirst.mockResolvedValue(null);

    const result = await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));

    expect(result.error).toBe("Opportunity not found");
    expect(mockGetAIProvider).not.toHaveBeenCalled();
  });

  it("returns an error when there are no comments to analyze yet", async () => {
    prismaMocks.opportunityFindFirst.mockResolvedValue({
      id: "opp-1",
      content: "post body",
      conversation: null,
    });

    const result = await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));

    expect(result.error).toContain("No comments");
    expect(mockGetAIProvider).not.toHaveBeenCalled();
  });

  it("calls analyzeConversation exactly once and saves the result", async () => {
    prismaMocks.opportunityFindFirst.mockResolvedValue({
      id: "opp-1",
      content: "post body",
      conversation: { comments: [storedComment] },
    });
    const analyzeConversation = vi.fn().mockResolvedValue([
      {
        commentExternalId: "c1",
        icpMatch: "High",
        problemExpressed: true,
        intent: "High",
        worthResponding: true,
        reason: "test",
      },
    ]);
    mockGetAIProvider.mockReturnValue({ analyzeConversation });

    const result = await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));

    expect(analyzeConversation).toHaveBeenCalledTimes(1);
    expect(prismaMocks.conversationUpdate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it("returns a specific error message when the AI call fails, instead of throwing", async () => {
    prismaMocks.opportunityFindFirst.mockResolvedValue({
      id: "opp-1",
      content: "post body",
      conversation: { comments: [storedComment] },
    });
    mockGetAIProvider.mockReturnValue({
      analyzeConversation: vi.fn().mockRejectedValue(new Error("model overloaded")),
    });

    const result = await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));

    expect(result.error).toContain("model overloaded");
    expect(prismaMocks.conversationUpdate).not.toHaveBeenCalled();
  });

  it("rate limits repeated analysis requests for the same project", async () => {
    prismaMocks.opportunityFindFirst.mockResolvedValue({
      id: "opp-1",
      content: "post body",
      conversation: { comments: [storedComment] },
    });
    const analyzeConversation = vi.fn().mockResolvedValue([]);
    mockGetAIProvider.mockReturnValue({ analyzeConversation });

    for (let i = 0; i < 40; i += 1) {
      await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));
    }
    const blocked = await analyzeConversationAction({}, formData({ opportunityId: "opp-1" }));

    expect(blocked.error).toContain("Try again");
    expect(analyzeConversation).toHaveBeenCalledTimes(40);
  });
});
