import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../mock-provider";

describe("MockAIProvider.analyzeSaaSWithChannels - search intelligence (no AI, deterministic)", () => {
  it("generates positive/synonym/negative keywords for a support-automation product", async () => {
    const ai = new MockAIProvider();
    const { analysis } = await ai.analyzeSaaSWithChannels({
      description: "A tool that automates repetitive customer support tickets for small teams.",
      problemSolved: "Support teams answer the same handful of questions over and over.",
      targetCustomer: null,
      website: null,
    });

    expect(analysis.positiveKeywords.length).toBeGreaterThan(0);
    expect(analysis.negativeKeywords.length).toBeGreaterThan(0);
    // Every positive keyword must be a real phrase, not an empty/placeholder string.
    for (const keyword of analysis.positiveKeywords) {
      expect(keyword.trim().length).toBeGreaterThan(0);
    }
  });

  it("generates a different keyword set for a completely different (developer-tools) product — not hardcoded to one business", async () => {
    const ai = new MockAIProvider();
    const support = await ai.analyzeSaaSWithChannels({
      description: "A tool that automates repetitive customer support tickets for small teams.",
      problemSolved: "Support teams answer the same handful of questions over and over.",
      targetCustomer: null,
      website: null,
    });
    const devTools = await ai.analyzeSaaSWithChannels({
      description: "A CI/CD deployment tool that automates infrastructure rollouts for engineering teams.",
      problemSolved: "Developers waste hours on manual deploy steps and fragmented tooling.",
      targetCustomer: null,
      website: null,
    });

    expect(devTools.analysis.productCategory).not.toBe(support.analysis.productCategory);
    expect(devTools.analysis.positiveKeywords).not.toEqual(support.analysis.positiveKeywords);
  });

  it("only attaches synonyms for keywords the generic table actually recognises", async () => {
    const ai = new MockAIProvider();
    const { analysis } = await ai.analyzeSaaSWithChannels({
      description: "A tool that automates repetitive customer support tickets for small teams.",
      problemSolved: "Support teams answer the same handful of questions over and over.",
      targetCustomer: null,
      website: null,
    });

    for (const entry of analysis.keywordSynonyms) {
      expect(analysis.positiveKeywords).toContain(entry.keyword);
      expect(entry.synonyms.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic — the same intake produces the same keyword strategy every time", async () => {
    const ai = new MockAIProvider();
    const intake = {
      description: "A scheduling tool for freelance consultants to manage client bookings.",
      problemSolved: "Freelancers double-book themselves and lose track of client schedules.",
      targetCustomer: null,
      website: null,
    };

    const first = await ai.analyzeSaaSWithChannels(intake);
    const second = await ai.analyzeSaaSWithChannels(intake);

    expect(second.analysis.positiveKeywords).toEqual(first.analysis.positiveKeywords);
    expect(second.analysis.keywordSynonyms).toEqual(first.analysis.keywordSynonyms);
    expect(second.analysis.negativeKeywords).toEqual(first.analysis.negativeKeywords);
  });
});

describe("MockAIProvider.analyzeSaaSWithChannels - use cases (Phase 2)", () => {
  it("uses the founder's own use-cases answer verbatim, one phrase per line, when given", async () => {
    const ai = new MockAIProvider();
    const { analysis } = await ai.analyzeSaaSWithChannels({
      description: "A tool that detects dead and stuck pixels on any screen.",
      problemSolved: "People can't tell if a monitor has dead pixels before it's too late to return it.",
      targetCustomer: null,
      website: null,
      useCases: "Testing a new TV for dead pixels\nChecking a second-hand monitor before buying",
    });

    expect(analysis.supportedUseCases).toEqual([
      "Testing a new TV for dead pixels",
      "Checking a second-hand monitor before buying",
    ]);
  });

  it("falls back to the archetype's search topics when no use-cases answer is given — never empty", async () => {
    const ai = new MockAIProvider();
    const { analysis } = await ai.analyzeSaaSWithChannels({
      description: "A tool that automates repetitive customer support tickets for small teams.",
      problemSolved: "Support teams answer the same handful of questions over and over.",
      targetCustomer: null,
      website: null,
    });

    expect(analysis.supportedUseCases.length).toBeGreaterThan(0);
  });

  it("never invents an unsupported-use-case list — stays empty since the demo engine cannot reliably infer it", async () => {
    const ai = new MockAIProvider();
    const { analysis } = await ai.analyzeSaaSWithChannels({
      description: "A tool that detects dead and stuck pixels on any screen.",
      problemSolved: "People can't tell if a monitor has dead pixels before it's too late to return it.",
      targetCustomer: null,
      website: null,
    });

    expect(analysis.unsupportedUseCases).toEqual([]);
  });

  it("existing projects onboarded before this field existed still work (useCases omitted entirely)", async () => {
    const ai = new MockAIProvider();
    await expect(
      ai.analyzeSaaSWithChannels({
        description: "A scheduling tool for freelance consultants to manage client bookings.",
        problemSolved: "Freelancers double-book themselves and lose track of client schedules.",
        targetCustomer: null,
        website: null,
      }),
    ).resolves.toBeDefined();
  });
});

describe("MockAIProvider.generateDiscoveryQueries - query diversity (deterministic)", () => {
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

  // Test 5: two consecutive eligible cycles produce meaningfully different
  // query sets — deterministic, not dependent on random output.
  it("generates a different batch on cycle 2 than cycle 1, given cycle 1's queries as history", async () => {
    const ai = new MockAIProvider();

    const cycle1 = await ai.generateDiscoveryQueries({ ...baseInput, recentQueries: [] });
    const cycle2 = await ai.generateDiscoveryQueries({
      ...baseInput,
      recentQueries: cycle1.queries,
    });

    expect(cycle1.queries.length).toBeGreaterThan(0);
    expect(cycle2.queries.length).toBeGreaterThan(0);
    // No overlap: cycle 2 was explicitly told to avoid cycle 1's phrasing.
    const overlap = cycle2.queries.filter((q) =>
      cycle1.queries.some((used) => used.toLowerCase() === q.toLowerCase()),
    );
    expect(overlap).toHaveLength(0);
  });

  it("is deterministic — the same inputs always produce the same batch", async () => {
    const ai = new MockAIProvider();
    const first = await ai.generateDiscoveryQueries({ ...baseInput, recentQueries: ["x"] });
    const second = await ai.generateDiscoveryQueries({ ...baseInput, recentQueries: ["x"] });
    expect(second.queries).toEqual(first.queries);
  });

  it("never produces an empty batch even after many cycles' worth of history", async () => {
    const ai = new MockAIProvider();
    let recentQueries: string[] = [];
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const result = await ai.generateDiscoveryQueries({ ...baseInput, recentQueries });
      expect(result.queries.length).toBeGreaterThan(0);
      recentQueries = [...recentQueries, ...result.queries];
    }
  });

  it("never invents a capability — every query is built only from the given business context", async () => {
    const ai = new MockAIProvider();
    const result = await ai.generateDiscoveryQueries({ ...baseInput, recentQueries: [] });
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
