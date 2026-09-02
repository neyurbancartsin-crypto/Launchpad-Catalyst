/**
 * Fixed-window rate limiting for auth and AI-spending actions.
 *
 * In-memory, so it protects a single instance only. That is enough for the
 * brute-force and runaway-cost cases it exists for; a multi-instance
 * deployment should back this with Redis (same interface, swap the store).
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) evictExpired(now);
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

function evictExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Still full of live windows: drop the oldest to bound memory.
  if (windows.size >= MAX_KEYS) {
    const oldest = [...windows.entries()].sort(
      (a, b) => a[1].resetAt - b[1].resetAt,
    );
    for (const [key] of oldest.slice(0, Math.ceil(MAX_KEYS / 10))) {
      windows.delete(key);
    }
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}

export const LIMITS = {
  /** Login attempts per email. Brute-force protection. */
  login: { limit: 8, windowSeconds: 900 },
  /** Signups per IP-less instance; blunt but stops scripted abuse. */
  signup: { limit: 5, windowSeconds: 3600 },
  /** Password-reset requests per email. */
  passwordReset: { limit: 4, windowSeconds: 3600 },
  /** AI-spending actions per user. Protects against runaway API cost. */
  aiAction: { limit: 40, windowSeconds: 3600 },
  /** Full discovery runs per user; each one fans out across platforms. */
  discovery: { limit: 10, windowSeconds: 3600 },
} as const;
