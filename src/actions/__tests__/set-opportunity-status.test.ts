import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireProjectWithIcp, prismaMocks } = vi.hoisted(() => ({
  mockRequireProjectWithIcp: vi.fn(),
  prismaMocks: { opportunityUpdateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { opportunity: { updateMany: prismaMocks.opportunityUpdateMany } },
}));

vi.mock("@/lib/project", () => ({
  requireProjectWithIcp: mockRequireProjectWithIcp,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setOpportunityStatusAction } = await import("../responses.actions");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProjectWithIcp.mockResolvedValue({ project: { id: "project-1" } });
  prismaMocks.opportunityUpdateMany.mockResolvedValue({ count: 1 });
});

describe("setOpportunityStatusAction - save/dismiss", () => {
  it("accepts SAVED (Phase 8: save an opportunity)", async () => {
    await setOpportunityStatusAction(formData({ opportunityId: "opp-1", status: "SAVED" }));

    expect(prismaMocks.opportunityUpdateMany).toHaveBeenCalledWith({
      where: { id: "opp-1", projectId: "project-1" },
      data: { status: "SAVED" },
    });
  });

  it("accepts IGNORED (Phase 8: dismiss an opportunity)", async () => {
    await setOpportunityStatusAction(formData({ opportunityId: "opp-1", status: "IGNORED" }));

    expect(prismaMocks.opportunityUpdateMany).toHaveBeenCalledWith({
      where: { id: "opp-1", projectId: "project-1" },
      data: { status: "IGNORED" },
    });
  });

  it("scopes the update to the caller's own project", async () => {
    mockRequireProjectWithIcp.mockResolvedValue({ project: { id: "someone-elses-project" } });

    await setOpportunityStatusAction(formData({ opportunityId: "opp-1", status: "SAVED" }));

    expect(prismaMocks.opportunityUpdateMany).toHaveBeenCalledWith({
      where: { id: "opp-1", projectId: "someone-elses-project" },
      data: { status: "SAVED" },
    });
  });

  it("silently ignores an invalid status value", async () => {
    await setOpportunityStatusAction(
      formData({ opportunityId: "opp-1", status: "NOT_A_REAL_STATUS" }),
    );

    expect(prismaMocks.opportunityUpdateMany).not.toHaveBeenCalled();
  });
});
