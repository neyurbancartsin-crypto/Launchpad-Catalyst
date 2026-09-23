import type { KeywordSynonymEntry, ProblemMapEntry } from "@/lib/ai/types";

/**
 * Turns the AI-generated search intelligence on an `ICP` into what discovery
 * actually consumes: a capped, deduplicated set of positive terms, intent
 * signals and negative terms, plus a breakdown by source for future
 * per-platform use. Pure and deterministic — no AI, no I/O — so it can run
 * on every discovery sync (including a future background one) for free.
 */

export interface SearchIntelligenceInput {
  /** New, specific positive terms (may be empty on a project onboarded before this field existed). */
  positiveKeywords: string[];
  keywordSynonyms: KeywordSynonymEntry[];
  negativeKeywords: string[];
  intentSignals: string[];
  problemMap: ProblemMapEntry[];
  buyingTriggers: string[];
  /** Old flat topic list — used only when `positiveKeywords` is empty, for backward compatibility. */
  searchTopics: string[];
}

export interface QueryGroup {
  /** Not shown to the user — just documents where a group of terms came from. */
  label: "positive" | "problem" | "situational";
  terms: string[];
}

export interface BuiltSearchStrategy {
  /** Ready to pass as `DiscoveryQuery.keywords` — capped, deduplicated, synonym-expanded. */
  positiveTerms: string[];
  /** Pass-through of intentSignals, deduplicated. */
  intentSignals: string[];
  /** A conversation matching one of these should be filtered out before scoring. */
  negativeTerms: string[];
  /** The same terms broken out by source, before capping/expansion — for future per-platform use. */
  groups: QueryGroup[];
}

export interface BuildSearchStrategyOptions {
  /** Upper bound on the final positive term count. Existing adapters already truncate further per their own rate limits; this just keeps the pool itself sane. */
  maxPositiveTerms?: number;
  /** How many synonyms a single keyword may contribute, and only once original terms are already included. */
  maxSynonymsPerKeyword?: number;
}

const DEFAULT_MAX_POSITIVE_TERMS = 15;
const DEFAULT_MAX_SYNONYMS_PER_KEYWORD = 2;

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** Case-insensitive dedup that keeps the first-seen original casing/text. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalise(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function buildSearchStrategy(
  icp: SearchIntelligenceInput,
  options: BuildSearchStrategyOptions = {},
): BuiltSearchStrategy {
  const maxPositiveTerms = options.maxPositiveTerms ?? DEFAULT_MAX_POSITIVE_TERMS;
  const maxSynonymsPerKeyword = options.maxSynonymsPerKeyword ?? DEFAULT_MAX_SYNONYMS_PER_KEYWORD;

  // Backward compatibility: a project onboarded before this field existed
  // has an empty positiveKeywords — fall back to the flat searchTopics list
  // it already had, so discovery keeps working unchanged for it.
  const positiveGroup = dedupe(
    icp.positiveKeywords.length > 0 ? icp.positiveKeywords : icp.searchTopics,
  );
  const problemGroup = dedupe(icp.problemMap.map((entry) => entry.problem));
  const situationalGroup = dedupe(icp.buyingTriggers);

  const groups: QueryGroup[] = [
    { label: "positive", terms: positiveGroup },
    { label: "problem", terms: problemGroup },
    { label: "situational", terms: situationalGroup },
  ];

  // Priority order: the founder's/AI's explicit positive keywords first,
  // then problem-map phrasing, then buying-trigger situations — each only
  // contributing terms not already present, so the same idea doesn't eat
  // twice into the size limit.
  const seenOriginal = new Set<string>();
  const originalTerms: string[] = [];
  for (const term of [...positiveGroup, ...problemGroup, ...situationalGroup]) {
    const key = normalise(term);
    if (seenOriginal.has(key)) continue;
    seenOriginal.add(key);
    originalTerms.push(term);
  }

  // Fill up to the cap with original terms first — preserving important
  // original terms takes priority over synonym variety.
  const capped = originalTerms.slice(0, maxPositiveTerms);
  const includedKeys = new Set(capped.map(normalise));

  // Only once original terms are in do we spend remaining room on synonyms —
  // never dump every synonym in regardless of size, and only expand
  // keywords that actually made the cut.
  const synonymByKeyword = new Map(
    icp.keywordSynonyms.map((entry) => [normalise(entry.keyword), entry.synonyms] as const),
  );
  for (const term of capped) {
    if (includedKeys.size >= maxPositiveTerms) break;
    const synonyms = synonymByKeyword.get(normalise(term));
    if (!synonyms) continue;
    for (const synonym of synonyms.slice(0, maxSynonymsPerKeyword)) {
      if (includedKeys.size >= maxPositiveTerms) break;
      const key = normalise(synonym);
      if (includedKeys.has(key)) continue;
      includedKeys.add(key);
      capped.push(synonym);
    }
  }

  return {
    positiveTerms: capped,
    intentSignals: dedupe(icp.intentSignals),
    negativeTerms: dedupe(icp.negativeKeywords),
    groups,
  };
}

/**
 * Conservative negative-keyword filter: excludes a conversation only when it
 * contains an exact (case-insensitive) negative phrase — no fuzzy or partial
 * matching, so it removes clear false-positive traps rather than any
 * potentially-useful conversation that loosely resembles one.
 */
export function matchesNegativeKeyword(text: string, negativeTerms: string[]): boolean {
  if (negativeTerms.length === 0) return false;
  const haystack = text.toLowerCase();
  return negativeTerms.some((term) => {
    const needle = term.trim().toLowerCase();
    return needle.length > 0 && haystack.includes(needle);
  });
}
