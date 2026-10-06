import type { Platform } from "@prisma/client";
import { SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import { BASE_INTENT_SIGNALS, selectArchetype, type Archetype } from "./archetypes";
import type {
  ChannelRecommendation,
  KeywordSynonymEntry,
  SaaSAnalysis,
  SaaSAnalysisWithChannels,
  SaaSIntake,
} from "./types";

/**
 * Deterministic, AI-free onboarding product analysis. Extracted from
 * `MockAIProvider.analyzeSaaSWithChannels` (the demo engine's offline
 * analysis) so it can also serve as `completeOnboardingAction`'s production
 * fallback when Gemini/Claude/OpenRouter is unavailable — same architecture
 * as `deterministic-discovery-queries.ts`. `MockAIProvider` now delegates
 * here too, so its existing behavior/tests are unchanged.
 *
 * Pure and synchronous: no I/O, no AI, nothing that can be rate-limited or
 * go down. Derives everything from the founder's own intake text via
 * keyword-matched `Archetype`s (see `./archetypes`) — it never invents a
 * product fact the founder didn't give or imply.
 */

export function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

/** Prefer the website's domain name; fall back to the first words of the description. */
function deriveProductName(input: SaaSIntake): string {
  if (input.website) {
    try {
      const url = new URL(
        input.website.startsWith("http") ? input.website : `https://${input.website}`,
      );
      const label = url.hostname.replace(/^www\./, "").split(".")[0];
      if (label) return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      // Not a valid URL — fall through to the description-based name.
    }
  }
  const words = input.description.trim().split(/\s+/).slice(0, 3).join(" ");
  return words || "Your product";
}

function humanizeCategory(archetypeId: string): string {
  const label = archetypeId.replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Specific problem-shaped phrases, sharper than the archetype's own
 * searchTopics — pulled from its problemMap/painPoints, which are already
 * written the way a customer would phrase them. Works for any archetype
 * (any business category), not just one hardcoded example.
 */
function derivePositiveKeywords(archetype: Archetype): string[] {
  const candidates = [
    ...archetype.problemMap.map((entry) => entry.problem),
    ...archetype.painPoints,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const phrase of candidates) {
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(phrase);
    if (result.length >= 8) break;
  }
  return result;
}

/**
 * A small, generic (not business-specific) synonym table. The demo engine
 * has no language model to reason about this particular product's own
 * wording, so it can only recognise common English business terms inside a
 * keyword — real variety still comes from the AI providers.
 */
const GENERIC_SYNONYMS: [pattern: RegExp, synonyms: string[]][] = [
  [/\bfreelancer/i, ["independent consultant", "self-employed", "solo business"]],
  [/\binvoice/i, ["bill", "billing statement"]],
  [/\bpayment/i, ["payout", "transaction"]],
  [/\bcustomer/i, ["client", "user"]],
  [/\bsupport ticket/i, ["support request", "help desk ticket"]],
  [/\bonboarding/i, ["setup process", "getting started"]],
  [/\bschedul/i, ["booking", "calendar management"]],
  [/\bpricing/i, ["cost", "plans"]],
  [/\bworkflow/i, ["process", "pipeline"]],
  [/\bremote/i, ["distributed", "work from home"]],
  [/\bautomat/i, ["automating", "hands-off"]],
  [/\btrack/i, ["monitor", "keep track of"]],
];

function deriveKeywordSynonyms(positiveKeywords: string[]): KeywordSynonymEntry[] {
  const entries: KeywordSynonymEntry[] = [];
  for (const keyword of positiveKeywords) {
    const match = GENERIC_SYNONYMS.find(([pattern]) => pattern.test(keyword));
    if (match) entries.push({ keyword, synonyms: match[1] });
  }
  return entries;
}

/**
 * Universally-safe exclusions. Unlike a real AI provider, the demo engine
 * cannot reason about this specific product's own false-positive traps, so
 * it only ever offers generic noise exclusions rather than guessing.
 */
const GENERIC_NEGATIVE_KEYWORDS = ["hiring", "job opening", "giveaway"];

/**
 * Splits the founder's own "main use cases" answer into individual phrases —
 * one per line, or one per sentence if they wrote it as prose. Used as-is
 * (not generated) since this is the founder's own text, not an inference.
 */
function deriveSupportedUseCases(input: SaaSIntake, archetype: Archetype): string[] {
  const raw = input.useCases?.trim();
  if (raw) {
    const lines = raw
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length > 0) return lines.slice(0, 8);
  }
  // No use-cases answer given: fall back to the archetype's own search
  // topics, which are already written as concrete scenarios rather than
  // abstract categories — better than leaving this empty.
  return archetype.searchTopics.slice(0, 5);
}

/** Consumer language must dominate and appear with no business language to read as B2C. */
function inferBusinessModel(corpus: string): "B2B" | "B2C" | "B2B2C" {
  const consumerSignals = /\bconsumers?\b|\beveryday people\b|\bindividuals\b|\bpersonal use\b|\bhobbyists?\b/;
  const businessSignals = /\bbusiness(es)?\b|\bcompan(y|ies)\b|\bteams?\b|\bstartups?\b|\benterprise\b|\bsaas\b|\bb2b\b/;
  return consumerSignals.test(corpus) && !businessSignals.test(corpus) ? "B2C" : "B2B";
}

interface ChannelCopyContext {
  analysis: SaaSAnalysis;
  input: SaaSIntake;
  topics: string;
  isB2B: boolean;
  isDevTool: boolean;
}

type ChannelCopyFields = Omit<ChannelRecommendation, "platform">;

/**
 * Per-platform Channel Strategist copy (PRD s7). Covers every platform the
 * app has ever known about, not just the currently active set — Reddit, X
 * and LinkedIn are deferred, not deleted, so their copy stays ready for the
 * day `SUPPORTED_PLATFORMS` includes them again.
 */
function channelCopyFor(platform: Platform, ctx: ChannelCopyContext): ChannelCopyFields {
  const { analysis, topics, isB2B, isDevTool } = ctx;

  switch (platform) {
    case "GITHUB":
      return {
        fitScore: isDevTool ? 9 : 6,
        priority: isDevTool ? "High" : "Medium",
        whyItFits: isDevTool
          ? "Your buyers file issues describing the exact workflow gap you solve, in public, often before they've considered a paid tool. Issue threads on relevant repos are some of the highest-intent text on the internet for a dev-tools product."
          : "GitHub skews toward engineers rather than your buyer, but issues on relevant open-source tools still surface operators describing real workflow pain worth answering.",
        whoToFind: analysis.roles.slice(0, 3).join(", "),
        topicsToTarget: topics,
        conversationsToJoin:
          "Issues and discussions where someone describes a workflow gap, asks how others solved it, or requests a feature your product already provides.",
        actionToTake:
          "Answer the technical question properly first. A product mention only belongs in a reply that would be useful with or without it.",
      };
    case "HACKERNEWS":
      return {
        fitScore: 8,
        priority: "High",
        whyItFits:
          "Ask HN threads are founders and engineers stating a problem directly and asking how others solved it — high-intent, high-signal text. Show HN is the one place on the internet where mentioning your own product is explicitly the point of the post.",
        whoToFind: `${analysis.roles[0] ?? "Founders"} and engineers posting about ${analysis.searchTopics[0] ?? "your problem space"}`,
        topicsToTarget: topics,
        conversationsToJoin:
          "Ask HN threads stating the problem directly, and Show HN posts closely adjacent to your category.",
        actionToTake:
          "Outside Show HN, add one concrete, specific insight with no pitch — HN is openly hostile to unsolicited self-promotion in comments.",
      };
    case "STACKOVERFLOW":
      return {
        fitScore: isDevTool ? 7 : 4,
        priority: isDevTool ? "Medium" : "Low",
        whyItFits: isDevTool
          ? "Developers ask precise, dated questions when they hit the exact limitation your product removes — strong signal, though the audience is narrower than GitHub or Hacker News."
          : "Stack Overflow's audience is almost entirely developers solving coding problems, which is a narrow match unless your product is itself a developer tool.",
        whoToFind: "Developers and technical operators searching for a solution to a specific, dated problem",
        topicsToTarget: topics,
        conversationsToJoin:
          "Questions where the asker describes hitting a wall your product removes, especially ones with no accepted answer yet.",
        actionToTake:
          "Answer the question on its technical merits. Stack Overflow's Help Center explicitly prohibits promotional answers — mention your product only if it is genuinely the direct answer.",
      };
    case "REDDIT":
      return {
        fitScore: 9,
        priority: "High",
        whyItFits:
          "Founders and operators describe problems in their own words on Reddit, in public, before they start shopping for tools. That makes it the highest-signal place to find people who have your problem but do not yet know your product exists.",
        whoToFind: analysis.roles.slice(0, 3).join(", "),
        topicsToTarget: topics,
        conversationsToJoin:
          "Threads where someone states the problem directly, asks how others solved it, or asks for a tool recommendation.",
        actionToTake:
          "Answer the question properly first. Earn the right to mention your product; do not lead with it.",
      };
    case "X":
      return {
        fitScore: 8,
        priority: "High",
        whyItFits:
          "Founders think out loud on X and reply to strangers. Conversations are shorter and faster than Reddit, and a genuinely useful reply is visible to everyone following the thread.",
        whoToFind: `${analysis.roles[0] ?? "Founders"} and operators posting about ${analysis.searchTopics[0] ?? "your problem space"}`,
        topicsToTarget: topics,
        conversationsToJoin:
          "Posts where someone describes the problem with real numbers, and threads asking for recommendations.",
        actionToTake:
          "Add one concrete, specific insight. Brevity is the format; a long pitch reads as spam.",
      };
    case "LINKEDIN":
      return {
        fitScore: isB2B ? 7 : 4,
        priority: isB2B ? "Medium" : "Low",
        whyItFits: isB2B
          ? "Your buyers list their job title publicly, and professional posts about operational problems attract exactly the people who own the budget for solving them."
          : "LinkedIn skews heavily B2B. With a B2C product the audience is a poor match, so treat it as a low-priority channel.",
        whoToFind: analysis.roles.join(", "),
        topicsToTarget: topics,
        conversationsToJoin:
          "Posts where a professional describes an operational problem candidly, rather than announcement or celebration posts.",
        actionToTake:
          "Leave a substantive comment that adds a perspective the post did not cover. Self-promotion is poorly received here.",
      };
  }
}

/**
 * Builds a complete `SaaSAnalysisWithChannels` from the founder's own
 * intake — no AI call, no network, cannot be rate-limited or go down. Used
 * directly by `MockAIProvider` (demo mode) and as `completeOnboardingAction`'s
 * fallback when a real AI provider is unavailable.
 */
export function generateDeterministicSaaSAnalysis(
  input: SaaSIntake,
): SaaSAnalysisWithChannels {
  const corpus = [input.description, input.problemSolved, input.targetCustomer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const archetype = selectArchetype(corpus);
  const productName = deriveProductName(input);
  const productCategory = humanizeCategory(archetype.id);
  const businessModel = inferBusinessModel(corpus);
  const primaryCustomer = input.targetCustomer?.trim() || archetype.primaryCustomer;
  const positiveKeywords = derivePositiveKeywords(archetype);

  const analysis: SaaSAnalysis = {
    productName,
    productSummary: `${productName} is a ${productCategory.toLowerCase()} for ${primaryCustomer.toLowerCase()}. ${firstSentence(input.description)}`,
    coreProblem: firstSentence(input.problemSolved),
    valueProposition: `${productName} helps ${primaryCustomer.toLowerCase()} solve ${firstSentence(input.problemSolved).toLowerCase().replace(/\.$/, "")}.`,
    productCategory,
    businessModel,
    likelyCompetitors: [],

    primaryCustomer,
    secondaryCustomer: archetype.secondaryCustomer,
    roles: archetype.roles,
    industries: archetype.industries,
    companySize: archetype.companySize,
    painPoints: archetype.painPoints,
    buyingTriggers: archetype.buyingTriggers,
    objections: archetype.objections,

    problemMap: archetype.problemMap,
    searchTopics: archetype.searchTopics,
    intentSignals: BASE_INTENT_SIGNALS,

    positiveKeywords,
    keywordSynonyms: deriveKeywordSynonyms(positiveKeywords),
    negativeKeywords: GENERIC_NEGATIVE_KEYWORDS,

    supportedUseCases: deriveSupportedUseCases(input, archetype),
    // No language model to reason about what this specific product does
    // NOT do — guessing here would risk inventing a limitation that isn't
    // real, which is worse than leaving it empty for the founder to fill in
    // on /strategy.
    unsupportedUseCases: [],
  };

  const isB2B = businessModel.startsWith("B2B");
  const isDevTool = /developer|api|sdk|infrastructure|devops|engineering/i.test(
    `${productCategory} ${corpus}`,
  );
  const topics = analysis.searchTopics.slice(0, 4).join(", ");
  const ctx: ChannelCopyContext = { analysis, input, topics, isB2B, isDevTool };

  // Only the platforms discovery actually runs against get recommended —
  // recommending a deferred platform would point the founder at a channel
  // with no live data behind it.
  const channels = SUPPORTED_PLATFORMS.map((platform) => ({
    platform,
    ...channelCopyFor(platform, ctx),
  })).sort((a, b) => b.fitScore - a.fitScore);

  return { analysis, channels };
}
