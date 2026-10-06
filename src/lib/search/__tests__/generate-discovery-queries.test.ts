import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICP, SaaSProject } from "@prisma/client";

const { prismaMocks } = vi.hoisted(() => ({
  prismaMocks: { discoveryRunFindMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { discoveryRun: { findMany: prismaMocks.discoveryRunFindMany } },
}));

// Deliberately NOT mocking "@/lib/ai/registry": generateFreshQueries must not
// import or call it at all. If it did, these tests would fail the moment
// AI_PROVIDER/GEMINI_API_KEY below are set to a broken configuration.
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
  it("produces a non-empty batch built from the ICP's own stored business context", async () => {
    const result = await generateFreshQueries(project, icp);

    expect(result.length).toBeGreaterThan(0);
    // Every query is recombined only from the ICP's own stored phrases —
    // never an invented phrase the ICP never mentioned.
    const knownPhrases = [...icp.positiveKeywords, ...icp.painPoints, ...icp.supportedUseCases, ...icp.searchTopics];
    for (const query of result) {
      expect(knownPhrases.some((phrase) => query.toLowerCase().includes(phrase.toLowerCase()))).toBe(true);
    }
  });

  it("only looks at a bounded recent window, not the project's entire discovery history", async () => {
    await generateFreshQueries(project, icp);

    const call = prismaMocks.discoveryRunFindMany.mock.calls[0][0];
    expect(call.take).toBeLessThanOrEqual(5);
    expect(call.orderBy).toEqual({ runAt: "desc" });
  });

  it("dedupes query history across the recent runs it reads before generating", async () => {
    prismaMocks.discoveryRunFindMany.mockResolvedValue([
      { queriesUsed: ["pain"] },
      { queriesUsed: ["pain"] }, // duplicate across runs
    ]);

    const result = await generateFreshQueries(project, icp);

    // "pain" (the bare phrase) was already used — this cycle must favor a
    // different angle on it rather than repeating it verbatim.
    expect(result).not.toContain("pain");
  });

  it("produces a genuinely different batch on the next cycle given this cycle's queries as history", async () => {
    const first = await generateFreshQueries(project, icp);

    prismaMocks.discoveryRunFindMany.mockResolvedValue([{ queriesUsed: first }]);
    const second = await generateFreshQueries(project, icp);

    const overlap = second.filter((q) => first.some((used) => used.toLowerCase() === q.toLowerCase()));
    expect(overlap).toHaveLength(0);
  });

  it("falls back to an empty array (never throws) when the ICP has no usable phrases", async () => {
    const emptyIcp = {
      productSummary: "",
      coreProblem: "",
      primaryCustomer: "",
      painPoints: [],
      problemMap: [],
      supportedUseCases: [],
      positiveKeywords: [],
      searchTopics: [],
    } as unknown as ICP;

    const result = await generateFreshQueries(project, emptyIcp);

    expect(result).toEqual([]);
  });

  it("falls back to an empty array (never throws) on an unexpected data shape", async () => {
    const malformedIcp = {
      productSummary: "summary",
      coreProblem: "problem",
      primaryCustomer: "customer",
      // Malformed: not an array, forces an exception inside the generator.
      painPoints: null,
      problemMap: [],
      supportedUseCases: ["use case"],
      positiveKeywords: ["keyword"],
      searchTopics: ["topic"],
    } as unknown as ICP;

    const result = await generateFreshQueries(project, malformedIcp);

    expect(result).toEqual([]);
  });

  it("works even when Gemini is misconfigured — discovery query generation never touches the AI provider", async () => {
    const originalProvider = process.env.AI_PROVIDER;
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.AI_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await generateFreshQueries(project, icp);
      expect(result.length).toBeGreaterThan(0);
    } finally {
      if (originalProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = originalProvider;
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
