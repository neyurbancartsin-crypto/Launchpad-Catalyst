import type { PromotionRisk } from "@prisma/client";

/**
 * Promotion risk (PRD s16). The system actively discourages spam: risk climbs
 * whenever a product mention would be unwelcome, unearned, or off-topic.
 */

export interface PromotionRiskInput {
  intentScore: number;
  relevanceScore: number;
  problemScore: number;
  selfPromoRules: "strict" | "moderate" | "lenient";
  mentionsCompetitor: boolean;
  /** True when the author explicitly asks for tools/recommendations. */
  asksForSolution: boolean;
}

export interface PromotionRiskResult {
  risk: PromotionRisk;
  reason: string;
}

export function assessPromotionRisk(
  input: PromotionRiskInput,
): PromotionRiskResult {
  const reasons: string[] = [];

  // Start from a neutral position and accumulate risk signals.
  let risk = 0;

  if (input.selfPromoRules === "strict") {
    risk += 2;
    reasons.push("this community enforces strict self-promotion rules");
  } else if (input.selfPromoRules === "moderate") {
    risk += 1;
  }

  // The strongest spam signal in the PRD: nobody asked, so a pitch is unsolicited.
  if (!input.asksForSolution) {
    risk += 2;
    reasons.push("the author is not asking for a solution");
  }

  if (input.intentScore < 40) {
    risk += 1;
    reasons.push("buying or solution intent is weak");
  }

  if (input.relevanceScore < 40) {
    risk += 1;
    reasons.push("the conversation is only loosely related to your product");
  }

  if (input.problemScore < 40) {
    risk += 1;
    reasons.push("the problem discussed is not clearly the one you solve");
  }

  // Someone naming a competitor is genuinely comparing options — that lowers
  // the risk of a mention reading as spam, provided intent is real.
  if (input.mentionsCompetitor && input.intentScore >= 40) {
    risk -= 1;
    reasons.push("the author is already comparing tools in this space");
  }

  if (risk <= 1) {
    return {
      risk: "LOW",
      reason:
        reasons.length > 0
          ? `A product mention may fit naturally here — ${reasons.join(", ")}.`
          : "A product mention may fit naturally here: intent, relevance and the problem all line up.",
    };
  }

  if (risk <= 3) {
    return {
      risk: "MEDIUM",
      reason: `Provide value first; mention your product only if it is genuinely relevant — ${reasons.join(", ")}.`,
    };
  }

  return {
    risk: "HIGH",
    reason: `Do not promote here — ${reasons.join(", ")}.`,
  };
}

/** Phrases that indicate the author is actively soliciting a recommendation. */
const SOLUTION_REQUEST_PATTERNS = [
  "what tool",
  "what tools",
  "any tool",
  "any tool for",
  "anyone using",
  "recommend",
  "recommendation",
  "suggestions",
  "alternative to",
  "looking for",
  "which one should",
  "best tool",
  "how do i",
  "how can i",
  "how do you",
  "how are you solving",
  "does anyone know",
  "is there a way",
  "i'm struggling with",
  "i am struggling with",
  "i need",
];

export function detectsSolutionRequest(text: string): boolean {
  const haystack = text.toLowerCase();
  return SOLUTION_REQUEST_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export function mentionsAnyCompetitor(
  text: string,
  competitors: string[],
): boolean {
  const haystack = text.toLowerCase();
  return competitors.some((competitor) => {
    const needle = competitor.toLowerCase().trim();
    return needle.length > 1 && haystack.includes(needle);
  });
}
