import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

class FakeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
  ApiError: FakeApiError,
}));

const { GeminiAIProvider } = await import("../gemini-provider");

function fakeResponse(jsonBody: unknown) {
  return {
    text: JSON.stringify(jsonBody),
    candidates: [{ finishReason: "STOP" }],
    promptFeedback: undefined,
  };
}

const minimalResponseInput = {
  style: "helpful" as const,
  productName: "TestProduct",
  productSummary: "A test product.",
  valueProposition: "It tests things.",
  postTitle: "Test post",
  postBody: "Test body",
  targetComment: null,
  communityName: "test-community",
  platform: "GITHUB" as const,
  recommendedAction: "Do not engage",
  promotionRisk: "HIGH" as const,
  allowProductMention: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("GeminiAIProvider - retry on transient 5xx", () => {
  it("succeeds without retrying when the first call succeeds", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      fakeResponse({ draft: "hello", guidanceNote: "note" }),
    );
    const ai = new GeminiAIProvider();

    const result = await ai.generateResponse(minimalResponseInput);

    expect(result.draft).toBe("hello");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 5xx once and succeeds on the second attempt", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new FakeApiError(503, "overloaded"))
      .mockResolvedValueOnce(fakeResponse({ draft: "recovered", guidanceNote: "note" }));
    const ai = new GeminiAIProvider();

    const result = await ai.generateResponse(minimalResponseInput);

    expect(result.draft).toBe("recovered");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on repeated 5xx and returns the friendly error", async () => {
    mockGenerateContent.mockRejectedValue(new FakeApiError(503, "overloaded"));
    const ai = new GeminiAIProvider();

    await expect(ai.generateResponse(minimalResponseInput)).rejects.toThrow(
      "Gemini API is temporarily unavailable (503)",
    );
    // 1 initial attempt + 4 retries, never more.
    expect(mockGenerateContent).toHaveBeenCalledTimes(5);
  }, 15000);

  it("does not retry a 429 rate-limit error", async () => {
    mockGenerateContent.mockRejectedValue(new FakeApiError(429, "rate limited"));
    const ai = new GeminiAIProvider();

    await expect(ai.generateResponse(minimalResponseInput)).rejects.toThrow(
      "Gemini rate limit reached",
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401 auth error", async () => {
    mockGenerateContent.mockRejectedValue(new FakeApiError(401, "bad key"));
    const ai = new GeminiAIProvider();

    await expect(ai.generateResponse(minimalResponseInput)).rejects.toThrow(
      "Gemini rejected the API key",
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 404 model-not-found error", async () => {
    mockGenerateContent.mockRejectedValue(new FakeApiError(404, "model not found"));
    const ai = new GeminiAIProvider();

    await expect(ai.generateResponse(minimalResponseInput)).rejects.toThrow(
      "Gemini API returned 404",
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

describe("GeminiAIProvider - reduced AI usage", () => {
  it("scoreOpportunity never calls the model — the rationale is fully deterministic", async () => {
    const ai = new GeminiAIProvider();

    const result = await ai.scoreOpportunity({
      title: "Someone asking for help",
      content: "How do I solve this problem with your kind of tool?",
      communityName: "test-community",
      communityTopics: ["testing"],
      selfPromoRules: "moderate",
      upvotes: 5,
      commentCount: 2,
      postedAt: new Date("2026-01-01T00:00:00Z"),
      icpKeywords: ["testing"],
      problemKeywords: ["testing"],
      intentSignals: ["how do i"],
      productCategory: "Developer tools",
      competitors: [],
    });

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(typeof result.actionRationale).toBe("string");
    expect(result.actionRationale.length).toBeGreaterThan(0);
  });

  it("analyzeSaaSWithChannels produces both the analysis and channels from a single call", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      fakeResponse({
        productName: "TestProduct",
        productSummary: "summary",
        coreProblem: "problem",
        valueProposition: "value",
        productCategory: "Dev tools",
        businessModel: "B2B",
        likelyCompetitors: ["Acme"],
        primaryCustomer: "devs",
        secondaryCustomer: "teams",
        roles: ["dev"],
        industries: ["software"],
        companySize: "1-10",
        painPoints: ["pain"],
        buyingTriggers: ["trigger"],
        objections: ["objection"],
        problemMap: [{ problem: "p", relatedProblems: ["rp"] }],
        searchTopics: ["topic"],
        intentSignals: ["how do i"],
        positiveKeywords: ["unpaid invoice"],
        keywordSynonyms: [{ keyword: "unpaid invoice", synonyms: ["overdue invoice"] }],
        negativeKeywords: ["hiring"],
        channels: [
          {
            platform: "GITHUB",
            fitScore: 8,
            priority: "High",
            whyItFits: "x",
            whoToFind: "x",
            topicsToTarget: "x",
            conversationsToJoin: "x",
            actionToTake: "x",
          },
          {
            platform: "HACKERNEWS",
            fitScore: 5,
            priority: "Medium",
            whyItFits: "x",
            whoToFind: "x",
            topicsToTarget: "x",
            conversationsToJoin: "x",
            actionToTake: "x",
          },
          {
            platform: "STACKOVERFLOW",
            fitScore: 2,
            priority: "Low",
            whyItFits: "x",
            whoToFind: "x",
            topicsToTarget: "x",
            conversationsToJoin: "x",
            actionToTake: "x",
          },
        ],
      }),
    );
    const ai = new GeminiAIProvider();

    const { analysis, channels } = await ai.analyzeSaaSWithChannels({
      description: "A test product.",
      problemSolved: "Solves a problem.",
      targetCustomer: "Developers",
      website: "https://example.com",
    });

    // One call produced everything — no separate recommendChannels request.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(analysis.productSummary).toBe("summary");
    expect(analysis).not.toHaveProperty("channels");
    expect(channels).toHaveLength(3);
    expect(channels[0].fitScore).toBeGreaterThanOrEqual(channels[1].fitScore);
  });
});

describe("GeminiAIProvider - structured output / schema validation", () => {
  it("sends the Zod schema as responseJsonSchema alongside responseMimeType", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      fakeResponse({ draft: "hello", guidanceNote: "note" }),
    );
    const ai = new GeminiAIProvider();

    await ai.generateResponse(minimalResponseInput);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const config = mockGenerateContent.mock.calls[0][0].config;
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toMatchObject({
      type: "object",
      properties: {
        draft: { type: "string" },
        guidanceNote: { type: "string" },
      },
      required: expect.arrayContaining(["draft", "guidanceNote"]),
    });
  });

  it("reports the failing field path when the response does not match the schema", async () => {
    // `draft` is a number instead of a string — a real deviation Gemini could
    // still produce as valid JSON despite responseJsonSchema being sent.
    mockGenerateContent.mockResolvedValueOnce(
      fakeResponse({ draft: 12345, guidanceNote: "note" }),
    );
    const ai = new GeminiAIProvider();

    await expect(ai.generateResponse(minimalResponseInput)).rejects.toThrow(
      /did not match the expected schema[\s\S]*draft/,
    );
    // A schema mismatch is not a transient error — it must not be retried.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("reports every failing field when the combined SaaS analysis response has multiple mismatches", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      fakeResponse({
        productName: "TestProduct",
        productSummary: "summary",
        coreProblem: "problem",
        valueProposition: "value",
        productCategory: "Dev tools",
        // Invalid enum value — not one of "B2B" | "B2C" | "B2B2C".
        businessModel: "Business to Business",
        likelyCompetitors: ["Acme"],
        primaryCustomer: "devs",
        secondaryCustomer: "teams",
        roles: ["dev"],
        industries: ["software"],
        companySize: "1-10",
        painPoints: ["pain"],
        buyingTriggers: ["trigger"],
        objections: ["objection"],
        problemMap: [{ problem: "p", relatedProblems: ["rp"] }],
        searchTopics: ["topic"],
        intentSignals: ["how do i"],
        positiveKeywords: ["unpaid invoice"],
        keywordSynonyms: [{ keyword: "unpaid invoice", synonyms: ["overdue invoice"] }],
        negativeKeywords: ["hiring"],
        channels: [
          {
            // Human label instead of the exact platform code.
            platform: "GitHub",
            fitScore: 8,
            priority: "High",
            whyItFits: "x",
            whoToFind: "x",
            topicsToTarget: "x",
            conversationsToJoin: "x",
            actionToTake: "x",
          },
        ],
      }),
    );
    const ai = new GeminiAIProvider();

    await expect(
      ai.analyzeSaaSWithChannels({
        description: "A test product.",
        problemSolved: "Solves a problem.",
        targetCustomer: "Developers",
        website: "https://example.com",
      }),
    ).rejects.toThrow(
      /businessModel[\s\S]*channels\.0\.platform|channels\.0\.platform[\s\S]*businessModel/,
    );
  });
});
