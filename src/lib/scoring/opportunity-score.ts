/**
 * Deterministic opportunity scoring (PRD s15).
 *
 * Kept free of AI and I/O so scores are reproducible and unit-testable, and so
 * swapping the AI provider never changes the numbers. The AI layer supplies
 * narrative around these values, not the values themselves.
 */

import { assessContentQuality } from "./content-signals";
import { detectsSolutionRequest } from "./promotion-risk";

export interface ScoreComponents {
  icpScore: number;
  problemScore: number;
  intentScore: number;
  recencyScore: number;
  relevanceScore: number;
  engagementScore: number;
}

export const SCORE_WEIGHTS = {
  icpScore: 0.25,
  problemScore: 0.25,
  intentScore: 0.2,
  recencyScore: 0.1,
  relevanceScore: 0.1,
  engagementScore: 0.1,
} as const;

export type PriorityBandValue = "HIGH" | "REVIEW" | "LOW" | "DEPRIORITISE";

export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeOverallScore(components: ScoreComponents): number {
  const weighted =
    clampScore(components.icpScore) * SCORE_WEIGHTS.icpScore +
    clampScore(components.problemScore) * SCORE_WEIGHTS.problemScore +
    clampScore(components.intentScore) * SCORE_WEIGHTS.intentScore +
    clampScore(components.recencyScore) * SCORE_WEIGHTS.recencyScore +
    clampScore(components.relevanceScore) * SCORE_WEIGHTS.relevanceScore +
    clampScore(components.engagementScore) * SCORE_WEIGHTS.engagementScore;

  return Math.round(weighted);
}

/** PRD s15: 80-100 high, 60-79 worth reviewing, 40-59 low, below 40 deprioritise. */
export function priorityBand(score: number): PriorityBandValue {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "REVIEW";
  if (score >= 40) return "LOW";
  return "DEPRIORITISE";
}

export const PRIORITY_BAND_LABELS: Record<PriorityBandValue, string> = {
  HIGH: "High priority",
  REVIEW: "Worth reviewing",
  LOW: "Low priority",
  DEPRIORITISE: "Do not prioritise",
};

// --- Component heuristics ---------------------------------------------------

function normalise(text: string): string {
  return text.toLowerCase();
}

const STOPWORDS = new Set([
  "a", "an", "as", "at", "be", "by", "do", "if", "in", "is", "it", "me", "my",
  "no", "of", "on", "or", "so", "to", "up", "us", "we",
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "that",
  "this", "from", "they", "them", "their", "have", "has", "had", "was", "were",
  "our", "out", "its", "too", "all", "any", "can", "will", "would",
  "how", "what", "who", "why", "when", "where", "into", "over", "more", "most",
  "some", "than", "then", "there", "these", "those", "been", "being", "does",
  "did", "get", "got", "just", "like", "make", "made", "much", "very",
]);

function tokenize(text: string): string[] {
  return normalise(text).match(/[a-z0-9]+/g) ?? [];
}

function contentTokens(phrase: string): string[] {
  return tokenize(phrase).filter(
    (token) => token.length >= 2 && !STOPWORDS.has(token),
  );
}

/** Long phrases matching fewer than half their words are incidental overlap. */
const PARTIAL_MATCH_THRESHOLD = 0.5;

/**
 * How strongly a single phrase is present in the text, from 0 to 1.
 *
 * An exact phrase match scores 1. Longer, sentence-like phrases (pain points,
 * problem statements) also earn partial credit for word overlap, because real
 * posts describe a problem in their own words rather than quoting yours.
 * Short phrases stay exact-match only, so "what tool" cannot be satisfied by
 * the words "what" and "tool" appearing separately.
 */
function phraseStrength(haystack: string, tokens: Set<string>, phrase: string): number {
  const needle = normalise(phrase).trim();
  if (needle.length === 0) return 0;
  if (haystack.includes(needle)) return 1;

  const phraseTokens = contentTokens(phrase);
  if (phraseTokens.length < 3) return 0;

  const hits = phraseTokens.filter((token) => tokens.has(token)).length;
  const fraction = hits / phraseTokens.length;
  return fraction >= PARTIAL_MATCH_THRESHOLD ? fraction : 0;
}

/**
 * How well the text matches a set of phrases, scaled to 0-100.
 * `saturateAt` caps how many matches are needed for a full score so a long
 * keyword list doesn't make a perfect score unreachable.
 */
export function keywordMatchScore(
  text: string,
  phrases: string[],
  saturateAt = 3,
): number {
  if (phrases.length === 0) return 0;

  const haystack = normalise(text);
  const tokens = new Set(tokenize(text));

  const strengths = phrases
    .map((phrase) => phraseStrength(haystack, tokens, phrase))
    .sort((a, b) => b - a);

  const target = Math.max(1, Math.min(saturateAt, phrases.length));
  const captured = strengths
    .slice(0, target)
    .reduce((total, strength) => total + strength, 0);

  return clampScore((captured / target) * 100);
}

/** Linear decay across a 30-day window (PRD s15 weights recency at 10%). */
export function recencyScore(
  postedAt: Date,
  now: Date = new Date(),
  windowDays = 30,
): number {
  const ageMs = now.getTime() - postedAt.getTime();
  if (ageMs <= 0) return 100;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= windowDays) return 0;
  return clampScore((1 - ageDays / windowDays) * 100);
}

/**
 * Log-scaled engagement so a 500-upvote post doesn't dwarf everything else.
 * Comments weigh more than upvotes: a discussion is worth more than a vote.
 */
export function engagementScore(upvotes: number, commentCount: number): number {
  const safeUpvotes = Math.max(0, upvotes);
  const safeComments = Math.max(0, commentCount);
  const signal = Math.log10(1 + safeUpvotes) * 20 + Math.log10(1 + safeComments) * 35;
  return clampScore(signal);
}

/**
 * How much a genuine personal ask is present — a direct question, or a
 * phrase from `SOLUTION_REQUEST_PATTERNS` — independent of whether it
 * happens to match this project's own AI-generated intent phrases. Used
 * both to give a direct question credit on its own merits, and to tell a
 * real question apart from a listicle that merely mentions "best".
 */
function hasGenuineAsk(text: string): boolean {
  return /\?/.test(text) || detectsSolutionRequest(text);
}

export function computeComponents(input: {
  text: string;
  icpKeywords: string[];
  problemKeywords: string[];
  intentSignals: string[];
  productCategory: string;
  communityTopics: string[];
  upvotes: number;
  commentCount: number;
  postedAt: Date;
  now?: Date;
}): ScoreComponents {
  const relevanceCorpus = [input.productCategory, ...input.communityTopics];
  const genuineAsk = hasGenuineAsk(input.text);

  const rawIcpScore = keywordMatchScore(input.text, input.icpKeywords);
  const rawProblemScore = keywordMatchScore(input.text, input.problemKeywords);
  // A direct, personal ask is strong intent evidence on its own — it
  // shouldn't need to also happen to match one of this project's specific
  // AI-generated intent phrases to be recognised as intent.
  const rawIntentScore = Math.max(
    keywordMatchScore(input.text, input.intentSignals, 2),
    genuineAsk ? 65 : 0,
  );

  // Relevant != opportunity (PRD): a promotional pitch, job posting, or
  // generic listicle ("Best free invoice generator") can overlap with the
  // product's problem/ICP vocabulary as heavily as someone genuinely
  // describing their own problem, without being a real opportunity. Topic
  // relevance is left untouched below — the topic really is related — but
  // problem/ICP/intent are dampened, since this text isn't a person
  // describing their own situation.
  const { isLowQuality } = assessContentQuality(input.text, genuineAsk);
  const dampen = (score: number) => (isLowQuality ? Math.round(score * 0.3) : score);

  return {
    icpScore: dampen(rawIcpScore),
    problemScore: dampen(rawProblemScore),
    intentScore: dampen(clampScore(rawIntentScore)),
    recencyScore: recencyScore(input.postedAt, input.now),
    relevanceScore: keywordMatchScore(input.text, relevanceCorpus, 2),
    engagementScore: engagementScore(input.upvotes, input.commentCount),
  };
}
