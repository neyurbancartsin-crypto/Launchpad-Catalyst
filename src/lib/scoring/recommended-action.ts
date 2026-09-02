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
}

export interface RecommendedActionResult {
  action: RecommendedAction;
  rationale: string;
}

export function determineRecommendedAction(
  input: RecommendedActionInput,
): RecommendedActionResult {
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
        rationale:
          "The problem is a real match, but promotion would not be welcome here. Contribute experience with no pitch attached.",
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
        rationale:
          "The author is explicitly asking for a solution and this community tolerates relevant recommendations. Lead with the answer, then name your product.",
      };
    }
    return {
      action: "Explain a solution",
      rationale:
        "The author wants a solution, but mention your product only if it comes up naturally. Explain how the problem is usually solved first.",
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
      rationale:
        "They are describing your problem but are not shopping for a tool. Experience lands better than advice here.",
    };
  }

  if (input.problemScore >= 60) {
    return {
      action: "Give advice",
      rationale:
        "The problem matches what you solve and there is some intent. Useful, specific advice will stand out.",
    };
  }

  return {
    action: "Ask a clarifying question",
    rationale:
      "The fit is plausible but unclear. A good question surfaces whether this person actually has the problem you solve.",
  };
}
