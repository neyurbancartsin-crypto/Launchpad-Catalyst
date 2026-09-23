import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAIProvider,
  mockGetActiveProject,
  mockGetSessionUserId,
  mockSetActiveProjectCookie,
  mockRequireProjectWithIcp,
  mockRunDiscoverySync,
  mockRedirect,
  prismaMocks,
} = vi.hoisted(() => ({
  mockGetAIProvider: vi.fn(),
  mockGetActiveProject: vi.fn(),
  mockGetSessionUserId: vi.fn(),
  mockSetActiveProjectCookie: vi.fn(),
  mockRequireProjectWithIcp: vi.fn(),
  mockRunDiscoverySync: vi.fn(),
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
});

describe("completeOnboardingAction - onboarding AI failure path", () => {
  it("returns a form error instead of throwing when analyzeSaaSWithChannels fails", async () => {
    mockGetAIProvider.mockReturnValue({
      analyzeSaaSWithChannels: vi.fn().mockRejectedValue(new Error("schema mismatch")),
    });

    const result = await completeOnboardingAction({}, formData(validIntake));

    expect(result.error).toContain("schema mismatch");
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(prismaMocks.saaSProjectCreate).not.toHaveBeenCalled();
    expect(mockRunDiscoverySync).not.toHaveBeenCalled();
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
});

describe("refreshOpportunitiesAction - manual 'Find New Opportunities'", () => {
  const project = { id: "project-1" };
  const icp = { id: "icp-1" };

  it("still works: calls runDiscoverySync with isAuto: false", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project, icp });

    await refreshOpportunitiesAction();

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    expect(mockRunDiscoverySync).toHaveBeenCalledWith(project, icp, { isAuto: false });
  });

  it("does not throw when a run (e.g. an automatic one) is already in progress for this project", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project, icp });
    mockRunDiscoverySync.mockResolvedValue({ ran: false, reason: "locked" });

    await expect(refreshOpportunitiesAction()).resolves.not.toThrow();
  });
});
