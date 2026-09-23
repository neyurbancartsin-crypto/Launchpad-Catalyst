import { describe, expect, it } from "vitest";
import {
  assessPromotionRisk,
  detectsSolutionRequest,
  mentionsAnyCompetitor,
  type PromotionRiskInput,
} from "../promotion-risk";
import { determineRecommendedAction } from "../recommended-action";

const idealCase: PromotionRiskInput = {
  intentScore: 90,
  relevanceScore: 90,
  problemScore: 90,
  selfPromoRules: "lenient",
  mentionsCompetitor: false,
  asksForSolution: true,
};

describe("assessPromotionRisk", () => {
  it("returns LOW when intent, relevance and problem all align in a lenient community", () => {
    expect(assessPromotionRisk(idealCase).risk).toBe("LOW");
  });

  it("returns HIGH for an off-topic thread in a strict community", () => {
    const result = assessPromotionRisk({
      intentScore: 10,
      relevanceScore: 10,
      problemScore: 10,
      selfPromoRules: "strict",
      mentionsCompetitor: false,
      asksForSolution: false,
    });
    expect(result.risk).toBe("HIGH");
    expect(result.reason).toContain("Do not promote");
  });

  it("escalates risk when the author is not asking for a solution", () => {
    const asking = assessPromotionRisk(idealCase);
    const notAsking = assessPromotionRisk({ ...idealCase, asksForSolution: false });
    expect(asking.risk).toBe("LOW");
    expect(notAsking.risk).not.toBe("LOW");
  });

  it("escalates risk in strict communities", () => {
    const strict = assessPromotionRisk({ ...idealCase, selfPromoRules: "strict" });
    expect(strict.risk).toBe("MEDIUM");
    expect(strict.reason).toContain("strict self-promotion rules");
  });

  it("softens risk when a competitor is already being discussed with real intent", () => {
    const base = { ...idealCase, selfPromoRules: "strict" as const };
    const withCompetitor = assessPromotionRisk({ ...base, mentionsCompetitor: true });
    const withoutCompetitor = assessPromotionRisk(base);
    expect(withCompetitor.risk).toBe("LOW");
    expect(withoutCompetitor.risk).toBe("MEDIUM");
  });

  it("does not soften risk from a competitor mention when intent is weak", () => {
    const weak = {
      ...idealCase,
      intentScore: 10,
      selfPromoRules: "strict" as const,
      mentionsCompetitor: true,
    };
    expect(assessPromotionRisk(weak).risk).not.toBe("LOW");
  });

  it("always explains its reasoning", () => {
    for (const rules of ["strict", "moderate", "lenient"] as const) {
      const result = assessPromotionRisk({ ...idealCase, selfPromoRules: rules });
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("detectsSolutionRequest", () => {
  it("recognises the PRD intent signals", () => {
    expect(detectsSolutionRequest("How do I get my first customers?")).toBe(true);
    expect(detectsSolutionRequest("Looking for a support tool")).toBe(true);
    expect(detectsSolutionRequest("Anyone using Intercom?")).toBe(true);
    expect(detectsSolutionRequest("What tool do you use for this")).toBe(true);
    expect(detectsSolutionRequest("Alternative to Zendesk?")).toBe(true);
  });

  it("recognises the additional phrases requested for the MVP polish pass", () => {
    expect(detectsSolutionRequest("Does anyone know a good way to track this?")).toBe(true);
    expect(detectsSolutionRequest("Is there a way to automate this?")).toBe(true);
    expect(detectsSolutionRequest("I'm struggling with overdue invoices")).toBe(true);
    expect(detectsSolutionRequest("I need a tool for this")).toBe(true);
    expect(detectsSolutionRequest("How can I fix this?")).toBe(true);
  });

  it("does not fire on a plain statement", () => {
    expect(detectsSolutionRequest("We shipped our new pricing page today.")).toBe(false);
  });
});

describe("mentionsAnyCompetitor", () => {
  it("matches case insensitively", () => {
    expect(mentionsAnyCompetitor("We tried ZENDESK last year", ["Zendesk"])).toBe(true);
  });

  it("returns false with no competitors configured", () => {
    expect(mentionsAnyCompetitor("We tried Zendesk", [])).toBe(false);
  });

  it("ignores single-character noise entries", () => {
    expect(mentionsAnyCompetitor("anything at all", ["a"])).toBe(false);
  });
});

describe("determineRecommendedAction", () => {
  it("never engages on a deprioritised opportunity", () => {
    const result = determineRecommendedAction({
      band: "DEPRIORITISE",
      promotionRisk: "LOW",
      intentScore: 90,
      problemScore: 90,
      asksForSolution: true,
    });
    expect(result.action).toBe("Do not engage");
  });

  it("recommends a product mention only at low risk with explicit demand", () => {
    const result = determineRecommendedAction({
      band: "HIGH",
      promotionRisk: "LOW",
      intentScore: 85,
      problemScore: 85,
      asksForSolution: true,
    });
    expect(result.action).toBe("Mention your product");
  });

  it("withholds the product mention at medium risk even with high intent", () => {
    const result = determineRecommendedAction({
      band: "HIGH",
      promotionRisk: "MEDIUM",
      intentScore: 85,
      problemScore: 85,
      asksForSolution: true,
    });
    expect(result.action).toBe("Explain a solution");
  });

  it("never recommends promoting when risk is high", () => {
    for (const problemScore of [20, 60, 95]) {
      const result = determineRecommendedAction({
        band: "HIGH",
        promotionRisk: "HIGH",
        intentScore: 95,
        problemScore,
        asksForSolution: true,
      });
      expect(result.action).not.toBe("Mention your product");
    }
  });

  it("prefers experience sharing when the problem matches but intent is absent", () => {
    const result = determineRecommendedAction({
      band: "REVIEW",
      promotionRisk: "MEDIUM",
      intentScore: 20,
      problemScore: 75,
      asksForSolution: false,
    });
    expect(result.action).toBe("Share your experience");
  });

  it("falls back to a clarifying question when fit is unclear", () => {
    const result = determineRecommendedAction({
      band: "LOW",
      promotionRisk: "MEDIUM",
      intentScore: 30,
      problemScore: 30,
      asksForSolution: false,
    });
    expect(result.action).toBe("Ask a clarifying question");
  });
});
