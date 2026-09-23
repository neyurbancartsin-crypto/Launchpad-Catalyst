import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformRateLimitError } from "../../types";
import { GitHubAdapter } from "../github-adapter";

function rateLimitedResponse(resetEpochSeconds: number): Response {
  return {
    ok: false,
    status: 403,
    headers: new Headers({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(resetEpochSeconds),
    }),
    json: async () => ({ message: "API rate limit exceeded" }),
  } as unknown as Response;
}

describe("GitHubAdapter rate limiting", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    vi.restoreAllMocks();
  });

  it("throws a PlatformRateLimitError carrying the parsed reset time on a 403 rate-limit response", async () => {
    const resetEpochSeconds = Math.floor(Date.now() / 1000) + 42;
    global.fetch = vi.fn().mockResolvedValue(rateLimitedResponse(resetEpochSeconds));

    const adapter = new GitHubAdapter();
    let caught: unknown;
    try {
      await adapter.searchPosts("owner/repo", { keywords: ["webhook"] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PlatformRateLimitError);
    const error = caught as PlatformRateLimitError;
    expect(error.retryAt).toEqual(new Date(resetEpochSeconds * 1000));
    expect(error.message).toContain("GitHub rate limit reached");
  });

  it("never includes the GITHUB_TOKEN value anywhere in the rate-limit error", async () => {
    process.env.GITHUB_TOKEN = "ghp_supersecrettoken12345";
    global.fetch = vi.fn().mockResolvedValue(
      rateLimitedResponse(Math.floor(Date.now() / 1000) + 10),
    );

    const adapter = new GitHubAdapter();
    let caught: unknown;
    try {
      await adapter.searchPosts("owner/repo", { keywords: ["webhook"] });
    } catch (error) {
      caught = error;
    }

    expect(String((caught as Error).message)).not.toContain("ghp_supersecrettoken12345");
  });

  it("declares a search budget safely under GitHub's ~30 req/min search rate limit", () => {
    const adapter = new GitHubAdapter();
    expect(adapter.maxCommunitiesPerSync).toBeGreaterThan(0);
    expect(adapter.maxCommunitiesPerSync).toBeLessThan(30);
  });
});
