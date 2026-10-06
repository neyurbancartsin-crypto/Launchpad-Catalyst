import { describe, expect, it } from "vitest";
import { generateDeterministicSaaSAnalysis } from "../deterministic-saas-analysis";

const intake = {
  description: "A tool that automates repetitive support tickets for small teams.",
  problemSolved: "Support teams answer the same handful of questions over and over.",
  targetCustomer: null,
  website: null,
  useCases: null,
};

describe("generateDeterministicSaaSAnalysis", () => {
  it("produces the complete SaaSAnalysisWithChannels shape with no AI call", () => {
    const result = generateDeterministicSaaSAnalysis(intake);

    expect(typeof result.analysis.productName).toBe("string");
    expect(typeof result.analysis.productSummary).toBe("string");
    expect(typeof result.analysis.coreProblem).toBe("string");
    expect(Array.isArray(result.analysis.painPoints)).toBe(true);
    expect(Array.isArray(result.analysis.problemMap)).toBe(true);
    expect(Array.isArray(result.analysis.supportedUseCases)).toBe(true);
    expect(Array.isArray(result.analysis.unsupportedUseCases)).toBe(true);
    expect(Array.isArray(result.analysis.searchTopics)).toBe(true);
    expect(Array.isArray(result.analysis.positiveKeywords)).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
    expect(result.channels.length).toBeGreaterThan(0);
    for (const channel of result.channels) {
      expect(typeof channel.platform).toBe("string");
      expect(typeof channel.fitScore).toBe("number");
      expect(typeof channel.whyItFits).toBe("string");
    }
  });

  it("is deterministic — identical intake always produces identical output", () => {
    const first = generateDeterministicSaaSAnalysis(intake);
    const second = generateDeterministicSaaSAnalysis(intake);
    expect(second).toEqual(first);
  });

  it("never invents a product fact — supportedUseCases uses the founder's own text when given", () => {
    const result = generateDeterministicSaaSAnalysis({
      ...intake,
      useCases: "Triaging incoming support tickets automatically",
    });
    expect(result.analysis.supportedUseCases).toContain(
      "Triaging incoming support tickets automatically",
    );
  });

  it("handles minimal/incomplete intake without crashing", () => {
    const minimal = {
      description: "A product.",
      problemSolved: "A problem.",
      targetCustomer: null,
      website: null,
      useCases: null,
    };
    expect(() => generateDeterministicSaaSAnalysis(minimal)).not.toThrow();
    const result = generateDeterministicSaaSAnalysis(minimal);
    expect(result.analysis.productName.length).toBeGreaterThan(0);
    expect(result.channels.length).toBeGreaterThan(0);
  });
});
