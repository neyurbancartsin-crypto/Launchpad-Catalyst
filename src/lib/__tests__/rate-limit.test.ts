import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimits } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it("allows requests up to the limit and blocks the next one", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("k", 3, 60).allowed).toBe(true);
    }
    expect(rateLimit("k", 3, 60).allowed).toBe(false);
  });

  it("reports remaining budget", () => {
    expect(rateLimit("k", 3, 60).remaining).toBe(2);
    expect(rateLimit("k", 3, 60).remaining).toBe(1);
    expect(rateLimit("k", 3, 60).remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 60).allowed).toBe(true);
    expect(rateLimit("a", 1, 60).allowed).toBe(false);
    expect(rateLimit("b", 1, 60).allowed).toBe(true);
  });

  it("supplies a retry hint when blocked", () => {
    rateLimit("k", 1, 60);
    const blocked = rateLimit("k", 1, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("opens a fresh window once the old one expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    expect(rateLimit("k", 1, 60).allowed).toBe(true);
    expect(rateLimit("k", 1, 60).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(rateLimit("k", 1, 60).allowed).toBe(true);

    vi.useRealTimers();
  });
});
