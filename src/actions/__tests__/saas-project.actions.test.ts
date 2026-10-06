import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAIProvider,
  mockGetActiveProject,
  mockGetSessionUserId,
  mockSetActiveProjectCookie,
  mockRequireProjectWithIcp,
  mockRunDiscoverySync,
  mockManualDiscoveryAvailableAt,
  mockRedirect,
  prismaMocks,
} = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn(),
  mockGetActiveProject: vi.fn(),
  mockGetSessionUserId: vi.fn(),
  mockSetActiveProjectCookie: vi.fn(),
  mockRequireProjectWithIcp: vi.fn(),
  mockRunDiscoverySync: vi.fn(),
  mockManualDiscoveryAvailableAt: vi.fn(),
  mockRedirect: vi.fn(),
  prismaMocks: {
    saaSProjectCreate: vi.fn(),
    saaSProjectUpdate: vi.fn(),
    icpUpsert: vi.fn(),
    channelUpsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    saaSProject: {
      create: prismaMocks.saaSProjectCreate,
      update: prismaMocks.saaSProjectUpdate,
    },
    iCP: { upsert: prismaMocks.icpUpsert },
    channel: { upsert: prismaMocks.channelUpsert },
  },
}));

vi.mock("@/lib/project", () => ({
  getActiveProject: mockGetActiveProject,
  getSessionUserId: mockGetSessionUserId,
  setActiveProjectCookie: mockSetActiveProjectCookie,
  clearActiveProjectCookie: vi.fn(),
  requireProjectWithIcp: mockRequireProjectWithIcp,
}));

vi.mock("@/lib/ai/registry", () => ({
  getAIProvider: mockGetAIProvider,
}));

// completeOnboardingAction/refreshOpportunitiesAction delegate the actual
// sync + locking + DiscoveryRun bookkeeping to `runDiscoverySync` — that
// module has its own dedicated tests (discovery-run.test.ts), so here it's
// mocked to keep this file focused on the onboarding action's own logic.
vi.mock("@/lib/discovery-run", () => ({
  runDiscoverySync: mockRunDiscoverySync,
  manualDiscoveryAvailableAt: mockManualDiscoveryAvailableAt,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { completeOnboardingAction, refreshOpportunitiesAction } = await import(
  "../saas-project.actions"
);

const fakeAnalysis = {
  productName: "TestProduct",
  productSummary: "summary",
  coreProblem: "problem",
  valueProposition: "value",
  productCategory: "Dev tools",
  businessModel: "B2B",
  likelyCompetitors: [],
  primaryCustomer: "devs",
  secondaryCustomer: "teams",
  roles: [],
  industries: [],
  companySize: "1-10",
  painPoints: [],
  buyingTriggers: [],
  objections: [],
  problemMap: [],
  searchTopics: [],
  intentSignals: [],
  positiveKeywords: [],
  keywordSynonyms: [],
  negativeKeywords: [],
  supportedUseCases: [],
  unsupportedUseCases: [],
};

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validIntake = {
  productName: "TestProduct",
  description: "A tool that automates repetitive support tickets for small teams.",
  problemSolved: "Support teams answer the same handful of questions over and over.",
  targetCustomer: "",
  website: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUserId.mockResolvedValue("user-1");
  mockGetActiveProject.mockResolvedValue(null);
  prismaMocks.saaSProjectCreate.mockResolvedValue({ id: "project-1" });
  prismaMocks.saaSProjectUpdate.mockResolvedValue({ id: "project-1" });
  prismaMocks.icpUpsert.mockResolvedValue({ id: "icp-1" });
  mockRunDiscoverySync.mockResolvedValue({
    ran: true,
    summary: { discovered: 0, updated: 0, perPlatform: [] },
  });
  // Default: no cooldown in effect — individual cooldown tests override this.
  mockManualDiscoveryAvailableAt.mockReturnValue(null);
});

describe("completeOnboardingAction - AI-unavailable fallback", () => {
  // 1. Gemini (or whichever provider) succeeds: the existing AI-provided
  // result is used untouched, no fallback, no extra query param.
  it("uses the AI-provided analysis, not the deterministic fallback, when the AI call succeeds", async () => {
    const analyzeSaaSWithChannels = vi
      .fn()
      .mockResolvedValue({ analysis: fakeAnalysis, channels: [] });
    mockGetAIProvider.mockReturnValue({ analyzeSaaSWithChannels });

    await completeOnboardingAction({}, formData(validIntake));

    expect(prismaMocks.icpUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ productSummary: "summary" }) }),
    );
    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1");
  });

  // 2. 429 rate limit -> deterministic fallback, onboarding still completes.
  it("falls back to deterministic analysis on a Gemini 429 rate-limit error, and onboarding still completes", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi
        .fn()
        .mockRejectedValue(new Error("Gemini rate limit reached. The free tier has a limited requests-per-minute/day quota — try again shortly.")),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
    expect(prismaMocks.saaSProjectCreate).toHaveBeenCalledTimes(1);
    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
  });

  // 3. 503 / service unavailable -> deterministic fallback.
  it("falls back to deterministic analysis on a Gemini 503/transient error", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi.fn().mockRejectedValue(new Error("Gemini returned 503")),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
  });

  // 3b. 5xx failure after retries exhausted -> same fallback path (the
  // provider's own retry/backoff already ran before this throw reaches us).
  it("falls back to deterministic analysis after a provider's retries are exhausted", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi
        .fn()
        .mockRejectedValue(new Error("Gemini request failed after 5 attempts")),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
  });

  // 4. Network failure / timeout -> deterministic fallback.
  it("falls back to deterministic analysis on a network failure or timeout", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi.fn().mockRejectedValue(new Error("fetch failed: ETIMEDOUT")),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
  });

  // 5. Missing GEMINI_API_KEY throws inside getAIProvider() itself, before
  // analyzeSaaSWithChannels is ever reached — must still be caught and
  // fall back, not escape to the dashboard error boundary.
  it("falls back to deterministic analysis when getAIProvider() itself throws (e.g. missing API key)", async () => {
    mockGetAIProvider.mockImplementation(() => {
      throw new Error("GEMINI_API_KEY is not set. Set AI_PROVIDER=mock to use the demo engine instead.");
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
    expect(prismaMocks.saaSProjectCreate).toHaveBeenCalledTimes(1);
  });

  // 6. The deterministic fallback produces a complete, usable
  // SaaSAnalysisWithChannels shape — every field the ICP/Channel upserts
  // and the subsequent discovery run actually read is populated.
  it("the deterministic fallback produces valid ICP and Channel data from the founder's own intake", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi.fn().mockRejectedValue(new Error("Gemini rate limit reached")),
    });

    await completeOnboardingAction(
      {},
      formData({
        ...validIntake,
        description: "A tool that automates repetitive support tickets for small teams.",
        problemSolved: "Support teams answer the same handful of questions over and over.",
      }),
    );

    const icpCreate = prismaMocks.icpUpsert.mock.calls[0][0].create;
    expect(typeof icpCreate.productSummary).toBe("string");
    expect(icpCreate.productSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(icpCreate.painPoints)).toBe(true);
    expect(Array.isArray(icpCreate.searchTopics)).toBe(true);
    expect(Array.isArray(icpCreate.positiveKeywords)).toBe(true);
    expect(Array.isArray(icpCreate.supportedUseCases)).toBe(true);
    expect(Array.isArray(icpCreate.unsupportedUseCases)).toBe(true);

    // At least one Channel row was upserted with a well-formed recommendation.
    expect(prismaMocks.channelUpsert).toHaveBeenCalled();
    const channelCreate = prismaMocks.channelUpsert.mock.calls[0][0].create;
    expect(typeof channelCreate.fitScore).toBe("number");
    expect(typeof channelCreate.whyItFits).toBe("string");

    // 7. Onboarding completed successfully end-to-end on the fallback path.
    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1&aiFallback=1");
  });

  it("calls analyzeSaaSWithChannels exactly once on a normal onboarding submission", async () => {
    const analyzeSaaSWithChannels = vi
      .fn()
      .mockResolvedValue({ analysis: fakeAnalysis, channels: [] });
    mockGetAIProvider.mockReturnValue({ analyzeSaaSWithChannels });

    await completeOnboardingAction({}, formData(validIntake));

    expect(analyzeSaaSWithChannels).toHaveBeenCalledTimes(1);
  });

  it("runs discovery through the shared runDiscoverySync helper (isAuto: false) and redirects", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi
        .fn()
        .mockResolvedValue({ analysis: fakeAnalysis, channels: [] }),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    const [, , options] = mockRunDiscoverySync.mock.calls[0];
    expect(options).toEqual({ isAuto: false });
    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1");
  });

  // Phase 2.1: "What are the main use cases of your product?" is a new,
  // optional onboarding field — must flow through to both the AI intake and
  // the persisted SaaSProject, and must never break a submission that omits it.
  it("passes the optional useCases answer through to the AI intake when given", async () => {
    const analyzeSaaSWithChannels = vi
      .fn()
      .mockResolvedValue({ analysis: fakeAnalysis, channels: [] });
    mockGetAIProvider.mockReturnValue({ analyzeSaaSWithChannels });

    await completeOnboardingAction(
      {},
      formData({ ...validIntake, useCases: "Testing a new TV for dead pixels" }),
    );

    expect(analyzeSaaSWithChannels).toHaveBeenCalledWith(
      expect.objectContaining({ useCases: "Testing a new TV for dead pixels" }),
    );
    expect(prismaMocks.saaSProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ useCases: "Testing a new TV for dead pixels" }),
      }),
    );
  });

  it("still succeeds when useCases is omitted — an existing workflow must keep working unchanged", async () => {
    const analyzeSaaSWithChannels = vi
      .fn()
      .mockResolvedValue({ analysis: fakeAnalysis, channels: [] });
    mockGetAIProvider.mockReturnValue({ analyzeSaaSWithChannels });

    await completeOnboardingAction({}, formData(validIntake));

    expect(analyzeSaaSWithChannels).toHaveBeenCalledWith(
      expect.objectContaining({ useCases: null }),
    );
    expect(mockRedirect).toHaveBeenCalledWith("/strategy?onboarded=1");
  });

  it("persists supportedUseCases/unsupportedUseCases from the analysis onto the ICP", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi.fn().mockResolvedValue({
        analysis: {
          ...fakeAnalysis,
          supportedUseCases: ["testing a new TV for dead pixels"],
          unsupportedUseCases: ["physically repairing a cracked screen"],
        },
        channels: [],
      }),
    });

    await completeOnboardingAction({}, formData(validIntake));

    expect(prismaMocks.icpUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          supportedUseCases: ["testing a new TV for dead pixels"],
          unsupportedUseCases: ["physically repairing a cracked screen"],
        }),
      }),
    );
  });
});

describe("refreshOpportunitiesAction - manual 'Find New Opportunities'", () => {
  const project = { id: "project-1" };
  const icp = { id: "icp-1" };
  const idleState = { status: "idle" } as const;

  it("still works: calls runDiscoverySync with isAuto: false", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project, icp });
    mockRunDiscoverySync.mockResolvedValue({
      ran: true,
      summary: { discovered: 3, updated: 1, newOpportunityIds: [], perPlatform: [] },
    });

    await refreshOpportunitiesAction(idleState, new FormData());

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    expect(mockRunDiscoverySync).toHaveBeenCalledWith(project, icp, { isAuto: false });
  });

  it("returns the real discovered count instead of a bare void", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project, icp });
    mockRunDiscoverySync.mockResolvedValue({
      ran: true,
      summary: { discovered: 7, updated: 2, newOpportunityIds: [], perPlatform: [] },
    });

    const result = await refreshOpportunitiesAction(idleState, new FormData());

    expect(result).toEqual({ status: "ok", newCount: 7 });
  });

  it("does not throw when a run (e.g. an automatic one) is already in progress, and reports it as locked rather than a fake success", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project, icp });
    mockRunDiscoverySync.mockResolvedValue({ ran: false, reason: "locked" });

    const result = await refreshOpportunitiesAction(idleState, new FormData());

    expect(result).toEqual({ status: "locked" });
  });

  // Test 2 (cooldown): immediately after a successful discovery run, another
  // manual trigger is rejected — server-side, before runDiscoverySync is
  // even called, so it can't start a second expensive run.
  it("rejects a manual trigger during the 6-hour cooldown without running discovery again", async () => {
    const recentlySynced = { id: "project-1", lastSyncedAt: new Date() };
    mockRequireProjectWithIcp.mockResolvedValue({ project: recentlySynced, icp });
    const availableAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockManualDiscoveryAvailableAt.mockReturnValue(availableAt);

    const result = await refreshOpportunitiesAction(idleState, new FormData());

    expect(result).toEqual({ status: "cooldown", availableAt: availableAt.toISOString() });
    expect(mockRunDiscoverySync).not.toHaveBeenCalled();
  });

  // Test 3 (cooldown bypass): calling the server action directly — exactly
  // what a crafted request or a second tab would do — still hits the same
  // check, since it re-reads `lastSyncedAt` via `requireProjectWithIcp` on
  // every invocation rather than trusting anything the caller sends.
  it("cannot be bypassed by invoking the action directly multiple times in a row", async () => {
    const recentlySynced = { id: "project-1", lastSyncedAt: new Date() };
    mockRequireProjectWithIcp.mockResolvedValue({ project: recentlySynced, icp });
    mockManualDiscoveryAvailableAt.mockReturnValue(new Date(Date.now() + 1000 * 60));

    const first = await refreshOpportunitiesAction(idleState, new FormData());
    const second = await refreshOpportunitiesAction(idleState, new FormData());
    const third = await refreshOpportunitiesAction(idleState, new FormData());

    for (const result of [first, second, third]) {
      expect(result.status).toBe("cooldown");
    }
    expect(mockRunDiscoverySync).not.toHaveBeenCalled();
  });

  // Test 4 (after cooldown): once `manualDiscoveryAvailableAt` reports no
  // cooldown in effect (the real implementation returns null once 6 hours
  // have passed — see discovery-cooldown.test.ts), discovery runs normally.
  it("runs discovery normally once the cooldown has elapsed", async () => {
    const longAgoSynced = { id: "project-1", lastSyncedAt: new Date(Date.now() - 7 * 60 * 60 * 1000) };
    mockRequireProjectWithIcp.mockResolvedValue({ project: longAgoSynced, icp });
    mockManualDiscoveryAvailableAt.mockReturnValue(null);
    mockRunDiscoverySync.mockResolvedValue({
      ran: true,
      summary: { discovered: 2, updated: 0, newOpportunityIds: [], perPlatform: [] },
    });

    const result = await refreshOpportunitiesAction(idleState, new FormData());

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "ok", newCount: 2 });
  });
});
