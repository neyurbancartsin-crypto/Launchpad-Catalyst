import { describe, expect, it } from "vitest";
import {
  clampScore,
  computeComponents,
  computeOverallScore,
  engagementScore,
  keywordMatchScore,
  priorityBand,
  recencyScore,
  SCORE_WEIGHTS,
} from "../opportunity-score";

const flat = (value: number) => ({
  icpScore: value,
  problemScore: value,
  intentScore: value,
  recencyScore: value,
  relevanceScore: value,
  engagementScore: value,
});

describe("SCORE_WEIGHTS", () => {
  it("matches the PRD weighting and sums to 1", () => {
    expect(SCORE_WEIGHTS.icpScore).toBe(0.25);
    expect(SCORE_WEIGHTS.problemScore).toBe(0.25);
    expect(SCORE_WEIGHTS.intentScore).toBe(0.2);
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("computeOverallScore", () => {
  it("returns the same value when all components are equal", () => {
    expect(computeOverallScore(flat(0))).toBe(0);
    expect(computeOverallScore(flat(50))).toBe(50);
    expect(computeOverallScore(flat(100))).toBe(100);
  });

  it("weights ICP and problem match most heavily", () => {
    const icpHeavy = computeOverallScore({ ...flat(0), icpScore: 100 });
    const recencyHeavy = computeOverallScore({ ...flat(0), recencyScore: 100 });
    expect(icpHeavy).toBe(25);
    expect(recencyHeavy).toBe(10);
    expect(icpHeavy).toBeGreaterThan(recencyHeavy);
  });

  it("clamps out-of-range components instead of propagating them", () => {
    expect(computeOverallScore(flat(150))).toBe(100);
    expect(computeOverallScore(flat(-50))).toBe(0);
  });
});

describe("priorityBand", () => {
  it("maps the PRD bands at their exact boundaries", () => {
    expect(priorityBand(100)).toBe("HIGH");
    expect(priorityBand(80)).toBe("HIGH");
    expect(priorityBand(79)).toBe("REVIEW");
    expect(priorityBand(60)).toBe("REVIEW");
    expect(priorityBand(59)).toBe("LOW");
    expect(priorityBand(40)).toBe("LOW");
    expect(priorityBand(39)).toBe("DEPRIORITISE");
    expect(priorityBand(0)).toBe("DEPRIORITISE");
  });
});

describe("keywordMatchScore", () => {
  it("scores zero with no phrases or no matches", () => {
    expect(keywordMatchScore("anything", [])).toBe(0);
    expect(keywordMatchScore("unrelated text", ["support tickets"])).toBe(0);
  });

  it("is case insensitive", () => {
    expect(keywordMatchScore("Support Tickets everywhere", ["support tickets"], 1)).toBe(100);
  });

  it("saturates so a long keyword list stays reachable", () => {
    const phrases = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"];
    expect(keywordMatchScore("a1 b2 c3", phrases, 3)).toBe(100);
  });

  it("scales partial matches toward the saturation target", () => {
    expect(keywordMatchScore("only a1 here", ["a1", "b2", "c3"], 3)).toBe(33);
  });

  // Real posts describe a problem in their own words, never by quoting the
  // founder's pain-point sentence verbatim.
  it("gives long phrases partial credit for word overlap", () => {
    const post =
      "Our response time has slipped to 14 hours and customers are noticing";
    const painPoint = "Response time is slipping and customers have noticed";
    expect(keywordMatchScore(post, [painPoint], 1)).toBeGreaterThan(50);
  });

  it("ignores incidental overlap in long phrases", () => {
    const unrelated = "We just redesigned our pricing page this week";
    const painPoint = "Support team overloaded with repetitive billing tickets";
    expect(keywordMatchScore(unrelated, [painPoint], 1)).toBe(0);
  });

  it("keeps short phrases exact-match only", () => {
    // "what" and "tool" both appear, but not the phrase "what tool".
    expect(keywordMatchScore("what a useful tool this is", ["what tool"], 1)).toBe(0);
    expect(keywordMatchScore("what tool do you use", ["what tool"], 1)).toBe(100);
  });

  it("still matches multi-word intent signals as substrings", () => {
    const post = "Anyone using something they actually like?";
    expect(keywordMatchScore(post, ["anyone using"], 1)).toBe(100);
  });

  it("separates an on-topic post from an off-topic one", () => {
    const searchTopics = [
      "repetitive support tickets",
      "customer support automation",
      "support team overwhelmed",
      "reduce support workload",
    ];
    const onTopic =
      "Drowning in repetitive support tickets — what tool are you using? " +
      "Two-person team, 400 tickets a week and 70% are the same six questions.";
    const offTopic =
      "Thoughts on the new office space trend? Hybrid vs fully remote for a team of 12.";

    const onScore = keywordMatchScore(onTopic, searchTopics, 3);
    const offScore = keywordMatchScore(offTopic, searchTopics, 3);

    expect(onScore).toBeGreaterThan(50);
    expect(offScore).toBeLessThan(20);
    expect(onScore - offScore).toBeGreaterThan(40);
  });
});

describe("recencyScore", () => {
  const now = new Date("2026-01-31T00:00:00Z");

  it("gives a fresh post full marks", () => {
    expect(recencyScore(now, now)).toBe(100);
    expect(recencyScore(new Date("2026-02-01T00:00:00Z"), now)).toBe(100);
  });

  it("decays linearly and bottoms out past the window", () => {
    expect(recencyScore(new Date("2026-01-16T00:00:00Z"), now)).toBe(50);
    expect(recencyScore(new Date("2026-01-01T00:00:00Z"), now)).toBe(0);
    expect(recencyScore(new Date("2025-06-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("engagementScore", () => {
  it("returns zero for a post with no engagement", () => {
    expect(engagementScore(0, 0)).toBe(0);
  });

  it("increases with engagement and never exceeds 100", () => {
    expect(engagementScore(10, 5)).toBeGreaterThan(engagementScore(1, 0));
    expect(engagementScore(100000, 100000)).toBe(100);
  });

  it("values a comment more than an upvote", () => {
    expect(engagementScore(0, 20)).toBeGreaterThan(engagementScore(20, 0));
  });

  it("treats negative input as zero", () => {
    expect(engagementScore(-5, -5)).toBe(0);
  });
});

describe("computeComponents - relevant != opportunity", () => {
  const icpKeywords = ["small support team", "customer support"];
  const problemKeywords = ["overdue invoice", "chasing payment", "invoice tracking"];
  const intentSignals = ["how do you", "what tool"];
  const base = {
    icpKeywords,
    problemKeywords,
    intentSignals,
    productCategory: "invoicing",
    communityTopics: ["invoicing", "freelance"],
    upvotes: 5,
    commentCount: 3,
    postedAt: new Date("2026-01-30T00:00:00Z"),
    now: new Date("2026-01-31T00:00:00Z"),
  };

  it("scores a genuine problem/question post highly on problem and intent", () => {
    const genuine = computeComponents({
      ...base,
      text:
        "I've sent an invoice to my client three weeks ago and still haven't been paid. " +
        "How do you guys track overdue invoices?",
    });

    expect(genuine.problemScore).toBeGreaterThan(0);
    expect(genuine.intentScore).toBeGreaterThanOrEqual(65);
  });

  it("dampens problem/ICP/intent for a promotional pitch even with strong keyword overlap", () => {
    const promo = computeComponents({
      ...base,
      text:
        "Introducing our new invoice tracking tool! Check out our product to chase overdue payments automatically.",
    });
    const genuine = computeComponents({
      ...base,
      text:
        "I've sent an invoice to my client three weeks ago and still haven't been paid. " +
        "How do you guys track overdue invoices?",
    });

    expect(promo.problemScore).toBeLessThan(genuine.problemScore);
    expect(computeOverallScore(promo)).toBeLessThan(computeOverallScore(genuine));
  });

  it("dampens a generic listicle ('Best free invoice generator') that has no genuine ask attached", () => {
    const listicle = computeComponents({
      ...base,
      text: "Best free invoice generator for small teams chasing overdue payments",
    });
    const genuine = computeComponents({
      ...base,
      text:
        "I've sent an invoice to my client three weeks ago and still haven't been paid. " +
        "How do you guys track overdue invoices?",
    });

    // This is the exact PRD example: same "invoice" keyword overlap, but the
    // listicle must not out-score (or come close to) the genuine question.
    expect(computeOverallScore(listicle)).toBeLessThan(computeOverallScore(genuine));
  });

  it("does not dampen a listicle-style phrase when a genuine personal question is attached", () => {
    const withAsk = computeComponents({
      ...base,
      text:
        "What's the best free invoice tracking tool? I'm struggling with overdue payments from three clients.",
    });
    expect(withAsk.problemScore).toBeGreaterThan(0);
  });

  it("leaves topic relevance untouched by promotional suppression", () => {
    const promo = computeComponents({
      ...base,
      text: "Introducing our new invoice tracking tool! Check out our product.",
    });
    // relevanceScore is driven by productCategory/communityTopics overlap,
    // not by problem/intent phrasing — it should not be suppressed just
    // because the post itself is promotional.
    expect(promo.relevanceScore).toBe(
      keywordMatchScore(
        "Introducing our new invoice tracking tool! Check out our product.",
        ["invoicing", "invoicing", "freelance"],
        2,
      ),
    );
  });
});

describe("clampScore", () => {
  it("bounds values to 0-100 and rounds", () => {
    expect(clampScore(42.4)).toBe(42);
    expect(clampScore(42.6)).toBe(43);
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(101)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});
