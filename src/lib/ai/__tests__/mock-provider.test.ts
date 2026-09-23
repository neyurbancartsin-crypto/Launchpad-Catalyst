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
