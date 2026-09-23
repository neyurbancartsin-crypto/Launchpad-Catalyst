import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformRateLimitError } from "../../types";
import { StackOverflowAdapter } from "../stackoverflow-adapter";

function throttledResponse(): Response {
  return {
    ok: false,
    status: 400,
    json: async () => ({
      error_id: 502,
      error_message: "too many requests from this IP, more requests available in 5 seconds",
    }),
  } as unknown as Response;
}

describe("StackOverflowAdapter rate limiting", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws a PlatformRateLimitError (not a plain Error) on the Stack Exchange throttle-violation error_id", async () => {
    global.fetch = vi.fn().mockResolvedValue(throttledResponse());
    const adapter = new StackOverflowAdapter();

    let caught: unknown;
    try {
      await adapter.searchPosts("webhooks", { keywords: ["webhook"] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PlatformRateLimitError);
    expect((caught as Error).message).toContain("Stack Overflow rate limit");
  });

  it("throws a plain Error (not a rate limit) for a non-throttle API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error_id: 400, error_message: "bad parameter" }),
    } as unknown as Response);
    const adapter = new StackOverflowAdapter();

    let caught: unknown;
    try {
      await adapter.searchPosts("webhooks", { keywords: ["webhook"] });
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeInstanceOf(PlatformRateLimitError);
    expect((caught as Error).message).toContain("bad parameter");
  });
});
