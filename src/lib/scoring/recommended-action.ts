import type { PromotionRisk } from "@prisma/client";
import type { PriorityBandValue } from "./opportunity-score";

/**
 * Recommended action (PRD s17). Derived from the conversation's own signals so
 * the advice reflects what is actually happening in the thread.
 */

export const RECOMMENDED_ACTIONS = [
  "Answer the question",
  "Ask a clarifying question",
  "Share your experience",
  "Give advice",
  "Explain a solution",
  "Mention your product",
  "Do not engage",
] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export interface RecommendedActionInput {
  band: PriorityBandValue;
  promotionRisk: PromotionRisk;
  intentScore: number;
  problemScore: number;
  asksForSolution: boolean;
  /** The specific phrase that matched the founder's problem vocabulary, if any — grounds the rationale in this actual conversation rather than a generic template. */
  matchedProblemPhrase?: string | null;
  /** Set when this conversation appears to ask for a capability the product explicitly does not have. */
  unsupportedCapability?: { matched: boolean; phrase: string | null };
}

export interface RecommendedActionResult {
  action: RecommendedAction;
  rationale: string;
}

/** Appends a short, concrete quote from the conversation when one is available, instead of leaving the rationale as a generic score-bucket description. */
function withEvidence(rationale: string, matchedProblemPhrase?: string | null): string {
  if (!matchedProblemPhrase) return rationale;
  return `${rationale} (matched: "${matchedProblemPhrase}")`;
}

export function determineRecommendedAction(
  input: RecommendedActionInput,
): RecommendedActionResult {
  // No invented capabilities: once a conversation is flagged as asking for
  // something this product explicitly does not do, that takes precedence
  // over every other signal — a high problem/intent score on an unsupported
  // request is not a real opportunity, and must say so plainly rather than
  // silently scoring low with no explanation.
  if (input.unsupportedCapability?.matched) {
    return {
      action: "Do not engage",
      rationale: input.unsupportedCapability.phrase
        ? `This appears to be asking about "${input.unsupportedCapability.phrase}", which is outside what your product currently supports. Do not claim it can solve this.`
        : "This appears to ask for a capability your product does not have. Do not claim it can solve this.",
    };
  }

  if (input.band === "DEPRIORITISE") {
    return {
      action: "Do not engage",
      rationale:
        "This conversation scores too low on customer fit and problem match to be worth your time right now.",
    };
  }

  if (input.promotionRisk === "HIGH") {
    if (input.problemScore >= 60) {
      return {
        action: "Share your experience",
        rationale: withEvidence(
          "The problem is a real match, but promotion would not be welcome here. Contribute experience with no pitch attached.",
          input.matchedProblemPhrase,
        ),
      };
    }
    return {
      action: "Do not engage",
      rationale:
        "Promotion risk is high and the problem match is weak — engaging here is unlikely to help anyone.",
    };
  }

  if (input.asksForSolution && input.intentScore >= 60) {
    if (input.promotionRisk === "LOW") {
      return {
        action: "Mention your product",
        rationale: withEvidence(
          "The author is explicitly asking for a solution and this community tolerates relevant recommendations. Lead with the answer, then name your product.",
          input.matchedProblemPhrase,
        ),
      };
    }
    return {
      action: "Explain a solution",
      rationale: withEvidence(
        "The author wants a solution, but mention your product only if it comes up naturally. Explain how the problem is usually solved first.",
        input.matchedProblemPhrase,
      ),
    };
  }

  if (input.asksForSolution) {
    return {
      action: "Answer the question",
      rationale:
        "A direct question is on the table. Answer it properly — that is what earns you the right to be heard later.",
    };
  }

  if (input.problemScore >= 60 && input.intentScore < 40) {
    return {
      action: "Share your experience",
      rationale: withEvidence(
        "They are describing your problem but are not shopping for a tool. Experience lands better than advice here.",
        input.matchedProblemPhrase,
      ),
    };
  }

  if (input.problemScore >= 60) {
    return {
      action: "Give advice",
      rationale: withEvidence(
        "The problem matches what you solve and there is some intent. Useful, specific advice will stand out.",
        input.matchedProblemPhrase,
      ),
    };
  }

  return {
    action: "Ask a clarifying question",
    rationale:
      "The fit is plausible but unclear. A good question surfaces whether this person actually has the problem you solve.",
  };
}
