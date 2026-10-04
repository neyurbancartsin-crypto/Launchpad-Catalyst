import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICP, SaaSProject } from "@prisma/client";

const { mockGetAIProvider, prismaMocks } = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn(),
  prismaMocks: { discoveryRunFindMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { discoveryRun: { findMany: prismaMocks.discoveryRunFindMany } },
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

const { generateFreshQueries } = await import("../generate-discovery-queries");

const project = { id: "project-1" } as unknown as SaaSProject;
const icp = {
  productSummary: "summary",
  coreProblem: "problem",
  primaryCustomer: "customer",
  painPoints: ["pain"],
  problemMap: [],
  supportedUseCases: ["use case"],
  positiveKeywords: ["keyword"],
  searchTopics: ["topic"],
} as unknown as ICP;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.discoveryRunFindMany.mockResolvedValue([]);
});

describe("generateFreshQueries", () => {
  it("passes the ICP's stored business context and recent query history to the AI provider", async () => {
    prismaMocks.discoveryRunFindMany.mockResolvedValue([
      { queriesUsed: ["unpaid invoices", "chasing payments"] },
      { queriesUsed: ["unpaid invoices"] }, // duplicate across runs, should be deduped
    ]);
    const generateDiscoveryQueries = vi.fn().mockResolvedValue({ queries: ["new angle"] });
    mockGetAIProvider.mockReturnValue({ generateDiscoveryQueries });

    const result = await generateFreshQueries(project, icp);

    expect(result).toEqual(["new angle"]);
    expect(generateDiscoveryQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        productSummary: "summary",
        coreProblem: "problem",
        primaryCustomer: "customer",
        painPoints: ["pain"],
        supportedUseCases: ["use case"],
        positiveKeywords: ["keyword"],
        searchTopics: ["topic"],
        recentQueries: expect.arrayContaining(["unpaid invoices", "chasing payments"]),
      }),
    );
    // Deduped across the two runs' overlapping history.
    const call = generateDiscoveryQueries.mock.calls[0][0];
    expect(call.recentQueries).toHaveLength(2);
  });

  it("only looks at a bounded recent window, not the project's entire discovery history", async () => {
    const generateDiscoveryQueries = vi.fn().mockResolvedValue({ queries: [] });
    mockGetAIProvider.mockReturnValue({ generateDiscoveryQueries });

    await generateFreshQueries(project, icp);

    const call = prismaMocks.discoveryRunFindMany.mock.calls[0][0];
    expect(call.take).toBeLessThanOrEqual(5);
    expect(call.orderBy).toEqual({ runAt: "desc" });
  });

  it("falls back to an empty array (never throws) when the AI call fails", async () => {
    mockGetAIProvider.mockReturnValue({
      generateDiscoveryQueries: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    });

    const result = await generateFreshQueries(project, icp);

    expect(result).toEqual([]);
  });

  it("filters out blank queries from the AI response", async () => {
    mockGetAIProvider.mockReturnValue({
      generateDiscoveryQueries: vi.fn().mockResolvedValue({ queries: ["real query", "  ", ""] }),
    });

    const result = await generateFreshQueries(project, icp);

    expect(result).toEqual(["real query"]);
  });
});
