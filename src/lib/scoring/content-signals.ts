/**
 * Deterministic signals for the "relevant != opportunity" distinction.
 *
 * A post can share heavy keyword overlap with a product's problem/ICP
 * vocabulary without being a real customer-acquisition opportunity — e.g. a
 * "Best free invoice generator" listicle mentions "invoice" as much as
 * someone genuinely asking how to chase an overdue one, but only the latter
 * is a person with the problem. These checks are plain pattern matching, not
 * AI: they exist to stop keyword overlap alone from driving the score.
 */

/** An explicit pitch for the author's own thing — the clearest spam signal. */
const PROMOTIONAL_PITCH_PATTERNS = [
  "our product",
  "our tool",
  "our app",
  "our platform",
  "our new",
  "check out our",
  "check it out",
  "visit our website",
  "sign up now",
  "introducing",
  "we just launched",
  "we've launched",
  "proud to announce",
  "proud to launch",
  "excited to announce",
  "excited to launch",
  "shameless plug",
  "link in bio",
  "use code",
  "discount code",
  "% off",
];

/**
 * Third-person product marketing — a post that repeatedly names one product
 * and directs the reader to its site reads as an ad even without first-person
 * "our", e.g. "Workbass stands out... available at Workbass.com".
 */
const PRODUCT_SITE_PATTERNS = [
  /\bavailable at\b[^.?!]{0,25}\.(com|io|co|app|net)\b/i,
  /\bvisit:?\s*(www\.)?[a-z0-9-]+\.(com|io|co|app|net)\b/i,
];

const JOB_POSTING_PATTERNS = [
  "we're hiring",
  "we are hiring",
  "now hiring",
  "job opening",
  "job description",
  "apply now",
  "send your resume",
  "send us your cv",
  "is hiring a",
];

/**
 * Generic content-marketing framing — "Best X for Y", "Top 10 X", "Ultimate
 * guide to X" — the exact shape of a listicle/SEO article, not a person
 * describing their own situation. Only meaningful when nothing else in the
 * text suggests a genuine personal ask (see `hasGenuineAsk`); a real
 * question that happens to use "best" ("what's the best free tool for X,
 * I'm struggling with...") is not penalised.
 */
const LISTICLE_PATTERNS = [
  // "Best free invoice generator", "best CRM to use", "Best Free Invoice
  // Generator" (hyphenated compounds included) — a superlative product
  // phrase. Not required to be followed by "for"/"to": a genuine question
  // using "best" ("what's the best free tool, I'm struggling with...") is
  // already excluded upstream via `hasGenuineAsk`, so this can stay broad.
  /\bbest\s+(free\s+)?[a-z][a-z-]*(\s+[a-z][a-z-]*){0,3}/i,
  /\btop\s+\d+\b/i,
  /\b\d+\s+best\b/i,
  /\bultimate guide\b/i,
  /\bcomplete guide to\b/i,
  /\bhow to choose the best\b/i,
  /\bleads as\b/i,
  /\bstands out as\b/i,
];

export function isPromotionalPitch(text: string): boolean {
  const haystack = text.toLowerCase();
  return (
    PROMOTIONAL_PITCH_PATTERNS.some((pattern) => haystack.includes(pattern)) ||
    PRODUCT_SITE_PATTERNS.some((pattern) => pattern.test(text))
  );
}

export function isJobPosting(text: string): boolean {
  const haystack = text.toLowerCase();
  return JOB_POSTING_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function isListicleStyle(text: string): boolean {
  return LISTICLE_PATTERNS.some((pattern) => pattern.test(text));
}

export interface ContentQuality {
  /** True when problem/ICP/intent scoring should be dampened for this text. */
  isLowQuality: boolean;
  reason: string | null;
}

/**
 * `hasGenuineAsk` should be the same "does this read like a real question or
 * request" signal the rest of scoring already computes (question mark or a
 * direct solution-request phrase) — a listicle-style phrase next to a real
 * personal question is not suppressed, only a listicle with no genuine ask
 * attached to it.
 */
export function assessContentQuality(text: string, hasGenuineAsk: boolean): ContentQuality {
  if (isPromotionalPitch(text)) {
    return { isLowQuality: true, reason: "reads as a promotional pitch, not a genuine question" };
  }
  if (isJobPosting(text)) {
    return { isLowQuality: true, reason: "is a job posting, not a customer conversation" };
  }
  if (!hasGenuineAsk && isListicleStyle(text)) {
    return {
      isLowQuality: true,
      reason: "reads as generic listicle/marketing content rather than a personal problem",
    };
  }
  return { isLowQuality: false, reason: null };
}
