import { describe, expect, it } from "vitest";
import {
  buildSearchStrategy,
  matchesNegativeKeyword,
  type SearchIntelligenceInput,
} from "../build-query";

function baseInput(overrides: Partial<SearchIntelligenceInput> = {}): SearchIntelligenceInput {
  return {
    positiveKeywords: [],
    keywordSynonyms: [],
    negativeKeywords: [],
    intentSignals: [],
    problemMap: [],
    buyingTriggers: [],
    searchTopics: [],
    ...overrides,
  };
}

describe("buildSearchStrategy - generation", () => {
  it("uses positiveKeywords as the primary source when present", () => {
    const result = buildSearchStrategy(
      baseInput({ positiveKeywords: ["unpaid invoice", "overdue payment"] }),
    );
    expect(result.positiveTerms).toEqual(
      expect.arrayContaining(["unpaid invoice", "overdue payment"]),
    );
  });

  it("folds in problemMap and buyingTriggers without losing the original positive keywords", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["unpaid invoice"],
        problemMap: [{ problem: "client hasn't paid", relatedProblems: ["late payment"] }],
        buyingTriggers: ["client ghosted after project delivery"],
      }),
    );
    expect(result.positiveTerms).toContain("unpaid invoice");
    expect(result.groups.find((g) => g.label === "problem")?.terms).toContain(
      "client hasn't paid",
    );
    expect(result.groups.find((g) => g.label === "situational")?.terms).toContain(
      "client ghosted after project delivery",
    );
  });

  it("passes intentSignals and negativeKeywords through, deduplicated", () => {
    const result = buildSearchStrategy(
      baseInput({
        intentSignals: ["how do i", "how do i"],
        negativeKeywords: ["hiring", "hiring"],
      }),
    );
    expect(result.intentSignals).toEqual(["how do i"]);
    expect(result.negativeTerms).toEqual(["hiring"]);
  });

  it("respects the maxPositiveTerms size limit", () => {
    const positiveKeywords = Array.from({ length: 30 }, (_, i) => `term ${i}`);
    const result = buildSearchStrategy(baseInput({ positiveKeywords }), {
      maxPositiveTerms: 10,
    });
    expect(result.positiveTerms.length).toBeLessThanOrEqual(10);
  });
});

describe("buildSearchStrategy - synonym expansion", () => {
  it("adds synonyms for included keywords without dumping every synonym in", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["unpaid invoice"],
        keywordSynonyms: [
          {
            keyword: "unpaid invoice",
            synonyms: ["overdue invoice", "outstanding invoice", "late invoice", "delinquent invoice"],
          },
        ],
      }),
      { maxSynonymsPerKeyword: 2 },
    );

    expect(result.positiveTerms).toContain("unpaid invoice");
    expect(result.positiveTerms).toContain("overdue invoice");
    expect(result.positiveTerms).toContain("outstanding invoice");
    // Capped at 2 synonyms for this keyword — the rest are not dumped in.
    expect(result.positiveTerms).not.toContain("late invoice");
    expect(result.positiveTerms).not.toContain("delinquent invoice");
  });

  it("only expands synonyms for keywords that actually made the size cap", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["term a", "term b"],
        keywordSynonyms: [
          { keyword: "term a", synonyms: ["syn a1"] },
          { keyword: "term b", synonyms: ["syn b1"] },
        ],
      }),
      { maxPositiveTerms: 2 },
    );

    // Both original terms fill the entire cap — no room left for synonyms.
    expect(result.positiveTerms).toEqual(["term a", "term b"]);
  });

  it("ignores a synonym entry for a keyword that isn't a positive keyword", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["unpaid invoice"],
        keywordSynonyms: [{ keyword: "some unrelated term", synonyms: ["noise"] }],
      }),
    );
    expect(result.positiveTerms).not.toContain("noise");
  });
});

describe("buildSearchStrategy - duplicate removal", () => {
  it("removes case-insensitive duplicates across positiveKeywords/problemMap/buyingTriggers", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["Unpaid Invoice"],
        problemMap: [{ problem: "unpaid invoice", relatedProblems: [] }],
        buyingTriggers: ["UNPAID INVOICE"],
      }),
    );
    const occurrences = result.positiveTerms.filter(
      (t) => t.toLowerCase() === "unpaid invoice",
    );
    expect(occurrences).toHaveLength(1);
  });

  it("does not add a synonym that duplicates an already-included term", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["freelancer", "self-employed"],
        keywordSynonyms: [
          { keyword: "freelancer", synonyms: ["self-employed", "independent consultant"] },
        ],
      }),
    );
    const occurrences = result.positiveTerms.filter(
      (t) => t.toLowerCase() === "self-employed",
    );
    expect(occurrences).toHaveLength(1);
    expect(result.positiveTerms).toContain("independent consultant");
  });
});

describe("buildSearchStrategy - backward compatibility", () => {
  it("falls back to searchTopics when positiveKeywords is empty (a project onboarded before this feature)", () => {
    const result = buildSearchStrategy(
      baseInput({ positiveKeywords: [], searchTopics: ["webhook debugging", "api errors"] }),
    );
    expect(result.positiveTerms).toEqual(
      expect.arrayContaining(["webhook debugging", "api errors"]),
    );
  });

  it("prefers positiveKeywords over searchTopics when both are present", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["unpaid invoice"],
        searchTopics: ["invoice"],
      }),
    );
    expect(result.groups.find((g) => g.label === "positive")?.terms).toEqual(["unpaid invoice"]);
  });
});

describe("buildSearchStrategy - arbitrary business examples (not hardcoded)", () => {
  it("works for a project-management tool with no invoicing vocabulary at all", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["tasks falling through the cracks", "no visibility into project status"],
        keywordSynonyms: [
          {
            keyword: "tasks falling through the cracks",
            synonyms: ["dropped tasks", "missed deadlines"],
          },
        ],
        negativeKeywords: ["hiring a project manager"],
        buyingTriggers: ["team grew past 10 people"],
      }),
      { maxSynonymsPerKeyword: 2 },
    );

    expect(result.positiveTerms).toContain("tasks falling through the cracks");
    expect(result.positiveTerms).toContain("no visibility into project status");
    expect(result.positiveTerms).toContain("dropped tasks");
    expect(result.negativeTerms).toContain("hiring a project manager");
  });

  it("works for a fitness-coaching app with completely different vocabulary", () => {
    const result = buildSearchStrategy(
      baseInput({
        positiveKeywords: ["clients keep cancelling sessions", "hard to track client progress"],
        buyingTriggers: ["lost a client due to no-shows"],
      }),
    );
    expect(result.positiveTerms).toContain("clients keep cancelling sessions");
    expect(result.groups.find((g) => g.label === "situational")?.terms).toContain(
      "lost a client due to no-shows",
    );
  });
});

describe("matchesNegativeKeyword", () => {
  it("is conservative: only an exact phrase match excludes a conversation", () => {
    expect(matchesNegativeKeyword("We are hiring a support engineer", ["hiring"])).toBe(true);
    expect(
      matchesNegativeKeyword("I hired a plumber last week, unrelated to software", ["hiring"]),
    ).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesNegativeKeyword("NOW HIRING a designer", ["hiring"])).toBe(true);
  });

  it("returns false when there are no negative terms", () => {
    expect(matchesNegativeKeyword("anything at all", [])).toBe(false);
  });

  it("does not exclude a conversation with no negative-term overlap", () => {
    expect(
      matchesNegativeKeyword("How do you track overdue invoices?", ["hiring", "giveaway"]),
    ).toBe(false);
  });
});
