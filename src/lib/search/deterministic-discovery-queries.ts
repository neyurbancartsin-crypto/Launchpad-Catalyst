import type {
  DiscoveryQueryGenerationInput,
  DiscoveryQueryGenerationResult,
} from "@/lib/ai/types";

/**
 * Deterministic, AI-free search-angle generator for discovery query
 * diversity. Extracted from the demo engine (`MockAIProvider`) so the real
 * discovery pipeline never depends on an AI provider — or its rate
 * limits/outages — just to pick this cycle's search angles. `MockAIProvider`
 * now delegates here too, so its existing behavior/tests are unchanged.
 *
 * No randomness: diversity comes only from two deterministic inputs — which
 * angle template leads the batch (rotates with `recentQueries.length`) and
 * which candidates `recentQueries` already contains (skipped). Pure and
 * synchronous: no I/O, no AI, nothing that can be rate-limited or go down.
 */

const MAX_DISCOVERY_QUERIES = 12;

/**
 * Generic angle shapes applied to any existing ICP phrase. A real AI
 * provider could write genuinely new customer language from scratch; this
 * can only recombine phrases already stored on the ICP into differently
 * shaped questions — still enough to avoid literally repeating the same
 * batch cycle after cycle. Order matters — see the rotation below.
 */
const QUERY_ANGLE_TEMPLATES: ((phrase: string) => string)[] = [
  (p) => p,
  (p) => `how do i deal with ${p}`,
  (p) => `is there a tool for ${p}`,
  (p) => `${p} alternative`,
  (p) => `struggling with ${p}`,
  (p) => `anyone else dealing with ${p}`,
  (p) => `workaround for ${p}`,
  (p) => `recommendations for ${p}`,
];

/** Every distinct phrase already stored on the ICP that could seed a search query. */
function discoveryQueryPool(input: DiscoveryQueryGenerationInput): string[] {
  const phrases = [
    ...input.positiveKeywords,
    ...input.painPoints,
    ...input.problemMap.map((entry) => entry.problem),
    ...input.supportedUseCases,
    ...input.searchTopics,
  ];
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const phrase of phrases) {
    const trimmed = phrase.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push(trimmed);
  }
  return pool;
}

/**
 * Builds this cycle's fresh search-angle batch from the ICP's own stored
 * context plus recent discovery history — no AI call, no network, cannot be
 * rate-limited or go down. Returns an empty batch only when the ICP itself
 * has no usable phrases yet (e.g. onboarding not finished); callers already
 * fall back to the existing deterministic query strategy in that case.
 */
export function generateDeterministicDiscoveryQueries(
  input: DiscoveryQueryGenerationInput,
): DiscoveryQueryGenerationResult {
  const pool = discoveryQueryPool(input);
  if (pool.length === 0) return { queries: [] };

  const usedBefore = new Set(input.recentQueries.map((q) => q.trim().toLowerCase()));
  const rotation = input.recentQueries.length % QUERY_ANGLE_TEMPLATES.length;
  const orderedTemplates = [
    ...QUERY_ANGLE_TEMPLATES.slice(rotation),
    ...QUERY_ANGLE_TEMPLATES.slice(0, rotation),
  ];

  const seen = new Set<string>();
  const queries: string[] = [];
  outer: for (const template of orderedTemplates) {
    for (const phrase of pool) {
      if (queries.length >= MAX_DISCOVERY_QUERIES) break outer;
      const candidate = template(phrase.toLowerCase());
      const key = candidate.toLowerCase();
      if (usedBefore.has(key) || seen.has(key)) continue;
      seen.add(key);
      queries.push(candidate);
    }
  }

  // Filtering against recent history can exhaust a small ICP's pool after
  // enough cycles — fall back to the base phrases rather than returning
  // nothing; a query repeating across cycles is acceptable (diversity is
  // best-effort), an empty batch breaking discovery is not.
  if (queries.length === 0) return { queries: pool.slice(0, MAX_DISCOVERY_QUERIES) };
  return { queries };
}
