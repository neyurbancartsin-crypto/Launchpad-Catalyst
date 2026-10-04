import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDTO, PlatformAdapter, PostDTO } from "@/lib/adapters/types";
import type { ICP, SaaSProject } from "@prisma/client";
import { MockAIProvider } from "@/lib/ai/mock-provider";

/**
 * End-to-end relevance/scoring scenarios (Phase 7.3, scenarios A-E and G).
 *
 * Unlike the other `discovery*.test.ts` files, `ai.scoreOpportunity` here is
 * the REAL `MockAIProvider` rather than a stubbed response — these tests
 * exercise the actual business-context -> query-generation (via the real
 * `buildSearchStrategy`, exercised through `discovery.ts` itself) ->
 * retrieval -> deterministic relevance/scoring pipeline, so a regression in
 * `computeComponents`, the unsupported-capability guard, or
 * `determineRecommendedAction` would actually fail one of these.
 *
 * Only the database and the platform adapters are mocked — no network, no
 * real Postgres — consistent with every other discovery test in this repo
 * and safe to run against no live data at all.
 *
 * Scenario F (repeated discovery / duplicate prevention) is already covered
 * by `discovery-unchanged-skip.test.ts` and is not duplicated here.
 */

const { mockGetAdapter, prismaMocks } = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  prismaMocks: {
    communityUpsert: vi.fn(),
    opportunityFindUnique: vi.fn(),
    opportunityUpsert: vi.fn(),
    conversationUpsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    community: { upsert: prismaMocks.communityUpsert },
    opportunity: {
      findUnique: prismaMocks.opportunityFindUnique,
      upsert: prismaMocks.opportunityUpsert,
    },
    conversation: { upsert: prismaMocks.conversationUpsert },
  },
}));

vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: mockGetAdapter,
  SUPPORTED_PLATFORMS: ["GITHUB", "HACKERNEWS"],
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: () => new MockAIProvider(),
}));

const { syncOpportunities } = await import("../discovery");

const project = { id: "project-1", competitors: "none" } as unknown as SaaSProject;

/** A dead-pixel detection tool's ICP — mirrors the task's own worked example. */
const deadPixelIcp = {
  productCategory: "dead pixel detection tool",
  roles: [],
  problemMap: [{ problem: "dead pixel on a new monitor", relatedProblems: [] }],
  painPoints: ["can't confirm dead pixel before return window closes"],
  intentSignals: ["how do i", "any way to", "is there a tool"],
  buyingTriggers: [],
  positiveKeywords: ["dead pixel", "stuck pixel detection"],
  keywordSynonyms: [{ keyword: "dead pixel", synonyms: ["stuck pixel", "bad pixel"] }],
  negativeKeywords: [],
  supportedUseCases: ["testing a new TV for dead pixels", "checking a second-hand monitor before buying"],
  unsupportedUseCases: ["physically repairing a cracked screen"],
} as unknown as ICP;

function makeCommunity(externalId: string): CommunityDTO {
  return {
    externalId,
    name: externalId,
    url: `https://example.com/${externalId}`,
    description: "",
    memberCount: 100,
    selfPromoRules: "moderate",
    topics: ["display", "dead pixel"],
    isDemoData: false,
  };
}

function makePost(externalId: string, title: string, body: string): PostDTO {
  return {
    externalId,
    communityExternalId: "c",
    title,
    body,
    author: "someone",
    url: `https://example.com/${externalId}`,
    upvotes: 3,
    commentCount: 1,
    createdAt: new Date(),
    isDemoData: false,
  };
}

function makeAdapter(posts: PostDTO[], opts: { throwOnSearch?: Error } = {}): PlatformAdapter {
  return {
    platform: "GITHUB",
    getConnectionStatus: vi.fn().mockResolvedValue({
      platform: "GITHUB",
      status: "CONNECTED",
      message: "ok",
      isDemoData: false,
    }),
    discoverCommunities: vi.fn().mockResolvedValue([makeCommunity("c")]),
    searchPosts: opts.throwOnSearch
      ? vi.fn().mockRejectedValue(opts.throwOnSearch)
      : vi.fn().mockResolvedValue(posts),
    getPostDetails: vi.fn().mockResolvedValue(null),
    getComments: vi.fn().mockResolvedValue([]),
    getConversationContext: vi.fn().mockResolvedValue(null),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.communityUpsert.mockImplementation(async ({ create }: { create: { externalId: string } }) => ({
    id: `row-${create.externalId}`,
  }));
  prismaMocks.opportunityFindUnique.mockResolvedValue(null);
  prismaMocks.opportunityUpsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create);
  prismaMocks.conversationUpsert.mockResolvedValue({});
});

describe("Scenario A — clear product fit ranks above an unrelated post", () => {
  it("scores a genuine dead-pixel question higher than an unrelated conversation", async () => {
    const relevant = makePost(
      "relevant",
      "Dead pixel on brand new monitor?",
      "I think my new monitor has a dead pixel in the corner. Is there a tool to confirm it before my return window closes?",
    );
    const unrelated = makePost(
      "unrelated",
      "Best coffee maker for a small office?",
      "We're setting up a new office kitchen. What's a good coffee maker for about 10 people?",
    );

    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? makeAdapter([relevant, unrelated]) : makeAdapter([]),
    );

    await syncOpportunities(project, deadPixelIcp);

    const upserts = prismaMocks.opportunityUpsert.mock.calls.map((call) => call[0].create);
    const relevantRow = upserts.find((u) => u.externalPostId === "relevant");
    const unrelatedRow = upserts.find((u) => u.externalPostId === "unrelated");

    expect(relevantRow.opportunityScore).toBeGreaterThan(unrelatedRow.opportunityScore);
    expect(["HIGH", "REVIEW"]).toContain(relevantRow.priorityBand);
    expect(unrelatedRow.priorityBand).toBe("DEPRIORITISE");
  });
});

describe("Scenario B — semantic match without the exact keyword", () => {
  it("still scores well on a synonym the founder never typed, via AI-generated keywordSynonyms", async () => {
    // Deliberately uses "stuck pixel" only — never "dead pixel" — relying on
    // the ICP's own keywordSynonyms (expanded by buildSearchStrategy into
    // the icpKeywords discovery actually scores against).
    const post = makePost(
      "synonym-match",
      "Stuck pixel right out of the box",
      "Noticed what looks like a stuck pixel on this display right after unboxing it. Any way to be sure before I return it?",
    );
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? makeAdapter([post]) : makeAdapter([]),
    );

    await syncOpportunities(project, deadPixelIcp);

    const row = prismaMocks.opportunityUpsert.mock.calls[0][0].create;
    // The founder never typed "stuck pixel" anywhere directly — this only
    // matches through the AI-generated keywordSynonyms entry on "dead
    // pixel". Both icpScore (via positiveKeywords) and problemScore (via
    // the painPoint/problemMap synonym expansion) must pick it up; a purely
    // literal keyword match would score both at 0.
    expect(row.icpScore).toBeGreaterThan(0);
    expect(row.problemScore).toBeGreaterThan(0);
    expect(row.priorityBand).not.toBe("DEPRIORITISE");
  });
});

describe("Scenario C — keyword false positive does not score high", () => {
  it("does not let a listicle that happens to mention a positive keyword score as a real opportunity", async () => {
    const listicle = makePost(
      "listicle",
      "Top 10 Best Monitors for Gaming in 2026",
      "Here's our roundup of the best gaming monitors this year, ranked by refresh rate and dead pixel policy.",
    );
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? makeAdapter([listicle]) : makeAdapter([]),
    );

    await syncOpportunities(project, deadPixelIcp);

    const row = prismaMocks.opportunityUpsert.mock.calls[0][0].create;
    expect(row.priorityBand).not.toBe("HIGH");
    expect(row.recommendedAction).not.toBe("Mention your product");
  });
});

describe("Scenario D — unsupported capability is never claimed as solvable", () => {
  it("recommends not engaging on a physical screen-repair request even though it shares display vocabulary", async () => {
    const repairRequest = makePost(
      "repair-request",
      "Screen physically cracked, can I fix it myself?",
      "Dropped my monitor and the screen is physically cracked now. Is there any way to repair a cracked screen myself?",
    );
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? makeAdapter([repairRequest]) : makeAdapter([]),
    );

    await syncOpportunities(project, deadPixelIcp);

    const row = prismaMocks.opportunityUpsert.mock.calls[0][0].create;
    expect(row.recommendedAction).toBe("Do not engage");
    expect(row.actionRationale.toLowerCase()).toContain("outside what your product currently supports");
  });
});

describe("Scenario E — ambiguous conversation gets a cautious classification", () => {
  it("does not confidently promote a vague, weakly-matching post", async () => {
    const ambiguous = makePost(
      "ambiguous",
      "Monitors in general",
      "Thinking about monitors lately, not sure what I even want yet.",
    );
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB" ? makeAdapter([ambiguous]) : makeAdapter([]),
    );

    await syncOpportunities(project, deadPixelIcp);

    const row = prismaMocks.opportunityUpsert.mock.calls[0][0].create;
    expect(row.priorityBand).not.toBe("HIGH");
    expect(row.recommendedAction).not.toBe("Mention your product");
  });
});

describe("Scenario G — partial adapter failure is reported honestly", () => {
  it("keeps the succeeding platform's results while reporting the failing platform's error, without fabricating anything for it", async () => {
    const goodPost = makePost(
      "good",
      "Dead pixel question",
      "Does anyone know a reliable way to check for dead pixels before returning a monitor?",
    );
    mockGetAdapter.mockImplementation((platform: string) =>
      platform === "GITHUB"
        ? makeAdapter([goodPost])
        : makeAdapter([], { throwOnSearch: new Error("HackerNews API unavailable") }),
    );

    const result = await syncOpportunities(project, deadPixelIcp);

    const github = result.perPlatform.find((p) => p.platform === "GITHUB");
    const hackernews = result.perPlatform.find((p) => p.platform === "HACKERNEWS");

    expect(github?.status).toBe("OK");
    expect(github?.opportunities).toBe(1);
    expect(hackernews?.status).toBe("API_ERROR");
    expect(hackernews?.opportunities).toBe(0);
    expect(hackernews?.error).toContain("HackerNews API unavailable");
    expect(result.discovered).toBe(1);
  });
});
