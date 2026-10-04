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

/**
 * Regression tests: the Algolia HN Search API's `url` field is the EXTERNAL
 * link a story was submitted with (e.g. a Show HN post's product site), not
 * the Hacker News discussion itself — using it as `PostDTO.url` sends "Open
 * in original" to a third-party site instead of the HN thread. The canonical
 * discussion URL must always be `https://news.ycombinator.com/item?id=<id>`,
 * regardless of what the post links to.
 */
function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

describe("HackerNewsAdapter - canonical URL (Uaryn regression)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses the HN item URL, not the external product link, for a Show HN post (Uaryn case)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            objectID: "45678901",
            title: "Show HN: Uaryn – a thing I built",
            story_text: null,
            author: "founder123",
            url: "https://uaryn.com",
            points: 42,
            num_comments: 7,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const adapter = new HackerNewsAdapter();

    const [post] = await adapter.searchPosts("show_hn", { keywords: ["uaryn"] });

    expect(post.url).toBe("https://news.ycombinator.com/item?id=45678901");
    expect(post.url).not.toBe("https://uaryn.com");
  });

  it("uses the HN item URL for an Ask HN post", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            objectID: "11111111",
            title: "Ask HN: How do you track overdue invoices?",
            story_text: "Looking for approaches, not a specific tool.",
            author: "asker",
            url: null,
            points: 10,
            num_comments: 3,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const adapter = new HackerNewsAdapter();

    const [post] = await adapter.searchPosts("ask_hn", { keywords: ["invoice"] });

    expect(post.url).toBe("https://news.ycombinator.com/item?id=11111111");
  });

  it("uses the HN item URL for a regular (non-Show/Ask) submission with no external url field", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            objectID: "22222222",
            title: "A text-only front-page story",
            story_text: "Just discussion text, no link.",
            author: "someone",
            url: null,
            points: 5,
            num_comments: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const adapter = new HackerNewsAdapter();

    const [post] = await adapter.searchPosts("front_page", { keywords: ["anything"] });

    expect(post.url).toBe("https://news.ycombinator.com/item?id=22222222");
  });

  it("uses the HN item URL even when the post body mentions multiple external links (HTML and plain)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            objectID: "33333333",
            title: "Show HN: CompareTool – compares two other products",
            story_text:
              'Check out <a href="https://competitor-a.com">Competitor A</a> and https://competitor-b.io as well.',
            author: "builder",
            url: "https://comparetool.dev",
            points: 8,
            num_comments: 2,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const adapter = new HackerNewsAdapter();

    const [post] = await adapter.searchPosts("show_hn", { keywords: ["compare"] });

    expect(post.url).toBe("https://news.ycombinator.com/item?id=33333333");
    expect(post.url).not.toContain("comparetool.dev");
    expect(post.url).not.toContain("competitor-a.com");
    expect(post.url).not.toContain("competitor-b.io");
  });

  it("uses the HN item URL for getPostDetails/getConversationContext (the single-item Firebase-shaped endpoint), not the item's own external url", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 45678901,
        author: "founder123",
        text: null,
        points: 42,
        title: "Show HN: Uaryn – a thing I built",
        url: "https://uaryn.com",
        type: "story",
        created_at: "2026-01-01T00:00:00.000Z",
        children: [
          {
            id: 45678902,
            author: "commenter",
            text: "Interesting, how does it compare to https://other-product.com?",
            points: 2,
            title: null,
            url: null,
            type: "comment",
            created_at: "2026-01-01T01:00:00.000Z",
            children: [],
          },
        ],
      }),
    );
    const adapter = new HackerNewsAdapter();

    const details = await adapter.getPostDetails("45678901");
    const context = await adapter.getConversationContext("45678901");

    expect(details?.url).toBe("https://news.ycombinator.com/item?id=45678901");
    expect(context?.post.url).toBe("https://news.ycombinator.com/item?id=45678901");
    // A link mentioned inside a comment is part of the comment body text —
    // never promoted to the post's canonical URL either.
    expect(context?.comments[0]?.body).toContain("other-product.com");
    expect(context?.post.url).not.toContain("other-product.com");
  });
});
