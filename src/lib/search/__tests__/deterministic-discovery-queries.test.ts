import { describe, expect, it } from "vitest";
import { generateDeterministicDiscoveryQueries } from "../deterministic-discovery-queries";

const baseInput = {
  productSummary: "InvoiceFlow helps freelancers chase overdue invoices.",
  coreProblem: "Clients don't pay on time.",
  primaryCustomer: "freelance consultants",
  painPoints: ["clients not paying", "chasing freelance payments"],
  problemMap: [{ problem: "overdue invoice follow up", relatedProblems: [] }],
  supportedUseCases: ["tracking unpaid invoices", "sending payment reminders"],
  positiveKeywords: ["unpaid invoices"],
  searchTopics: ["late payment problems"],
};

describe("generateDeterministicDiscoveryQueries", () => {
  it("1. the first run produces a valid, non-empty batch", () => {
    const result = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: [] });
    expect(result.queries.length).toBeGreaterThan(0);
  });

  it("2. the second run produces queries different from the first run", () => {
    const run1 = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: [] });
    const run2 = generateDeterministicDiscoveryQueries({
      ...baseInput,
      recentQueries: run1.queries,
    });

    expect(run2.queries.length).toBeGreaterThan(0);
    const overlap = run2.queries.filter((q) =>
      run1.queries.some((used) => used.toLowerCase() === q.toLowerCase()),
    );
    expect(overlap).toHaveLength(0);
  });

  it("3. later runs continue rotating to unused search angles across many cycles", () => {
    let recentQueries: string[] = [];
    const seenAcrossAllCycles = new Set<string>();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      const result = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries });
      expect(result.queries.length).toBeGreaterThan(0);
      for (const q of result.queries) seenAcrossAllCycles.add(q.toLowerCase());
      recentQueries = [...recentQueries, ...result.queries];
    }
    // Rotating through multiple distinct angle templates over 8 cycles
    // must produce more than just one angle's worth of phrasing.
    expect(seenAcrossAllCycles.size).toBeGreaterThan(baseInput.positiveKeywords.length);
  });

  it("4. exact duplicate queries within a single batch are avoided", () => {
    const result = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: [] });
    const lowered = result.queries.map((q) => q.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });

  it("4b. exact duplicates already used in recent history are not repeated", () => {
    const run1 = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: [] });
    const run2 = generateDeterministicDiscoveryQueries({
      ...baseInput,
      recentQueries: run1.queries,
    });
    for (const used of run1.queries) {
      expect(run2.queries.map((q) => q.toLowerCase())).not.toContain(used.toLowerCase());
    }
  });

  it("6. the same business context produces different query sets across discovery runs", () => {
    const first = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: ["x"] });
    const second = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: ["x"] });
    // Deterministic: identical inputs still produce identical output.
    expect(second.queries).toEqual(first.queries);

    const third = generateDeterministicDiscoveryQueries({
      ...baseInput,
      recentQueries: [...first.queries],
    });
    expect(third.queries).not.toEqual(first.queries);
  });

  it("7. missing/incomplete business context does not crash the generator", () => {
    const minimal = {
      productSummary: "",
      coreProblem: "",
      primaryCustomer: "",
      painPoints: [],
      problemMap: [],
      supportedUseCases: [],
      positiveKeywords: [],
      searchTopics: [],
      recentQueries: [],
    };
    expect(() => generateDeterministicDiscoveryQueries(minimal)).not.toThrow();
    expect(generateDeterministicDiscoveryQueries(minimal).queries).toEqual([]);

    const productNameOnly = { ...minimal, searchTopics: ["n8n"] };
    expect(() => generateDeterministicDiscoveryQueries(productNameOnly)).not.toThrow();
    expect(generateDeterministicDiscoveryQueries(productNameOnly).queries.length).toBeGreaterThan(0);
  });

  it("never produces an empty batch even after many cycles' worth of history", () => {
    let recentQueries: string[] = [];
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const result = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries });
      expect(result.queries.length).toBeGreaterThan(0);
      recentQueries = [...recentQueries, ...result.queries];
    }
  });

  it("never invents a capability — every query is built only from the given business context", () => {
    const result = generateDeterministicDiscoveryQueries({ ...baseInput, recentQueries: [] });
    for (const query of result.queries) {
      const mentionsKnownPhrase = [
        ...baseInput.positiveKeywords,
        ...baseInput.painPoints,
        ...baseInput.problemMap.map((p) => p.problem),
        ...baseInput.supportedUseCases,
        ...baseInput.searchTopics,
      ].some((phrase) => query.toLowerCase().includes(phrase.toLowerCase()));
      expect(mentionsKnownPhrase).toBe(true);
    }
  });
});
