import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformRateLimitError } from "../../types";
import { HackerNewsAdapter } from "../hackernews-adapter";

function rateLimitedResponse(): Response {
  return {
    ok: false,
    status: 429,
    json: async () => ({}),
  } as unknown as Response;
}

describe("HackerNewsAdapter rate limiting", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws a PlatformRateLimitError (not a plain Error) on a 429 from the Algolia search API", async () => {
    global.fetch = vi.fn().mockResolvedValue(rateLimitedResponse());
    const adapter = new HackerNewsAdapter();

    let caught: unknown;
    try {
      await adapter.searchPosts("front_page", { keywords: ["webhook"] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PlatformRateLimitError);
    expect((caught as Error).message).toContain("Hacker News");
  });
});
