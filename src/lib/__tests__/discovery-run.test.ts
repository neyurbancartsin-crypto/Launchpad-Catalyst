import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICP, SaaSProject } from "@prisma/client";

const { mockSyncOpportunities, prismaMocks } = vi.hoisted(() => ({
  mockSyncOpportunities: vi.fn(),
  prismaMocks: {
    saaSProjectUpdateMany: vi.fn(),
    saaSProjectUpdate: vi.fn(),
    discoveryRunCreate: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    saaSProject: {
      updateMany: prismaMocks.saaSProjectUpdateMany,
      update: prismaMocks.saaSProjectUpdate,
    },
    discoveryRun: { create: prismaMocks.discoveryRunCreate },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/discovery", () => ({
  syncOpportunities: mockSyncOpportunities,
}));

const { runDiscoverySync, claimDiscoveryLock, formatSyncFailures } = await import(
  "../discovery-run"
);

const project = { id: "project-1" } as unknown as SaaSProject;
const icp = {} as unknown as ICP;

const emptySummary = { discovered: 0, updated: 0, perPlatform: [] };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: lock is free, claim succeeds.
  prismaMocks.saaSProjectUpdateMany.mockResolvedValue({ count: 1 });
  prismaMocks.saaSProjectUpdate.mockResolvedValue({ id: "project-1" });
  prismaMocks.discoveryRunCreate.mockResolvedValue({ id: "run-1" });
  mockSyncOpportunities.mockResolvedValue(emptySummary);
});

describe("claimDiscoveryLock", () => {
  it("claims the lock via a conditional updateMany that only matches an unlocked or stale row", async () => {
    const claimed = await claimDiscoveryLock("project-1");

    expect(claimed).toBe(true);
    const call = prismaMocks.saaSProjectUpdateMany.mock.calls[0][0];
    expect(call.where.id).toBe("project-1");
    expect(call.where.OR).toEqual([
      { discoveryStartedAt: null },
      { discoveryStartedAt: { lt: expect.any(Date) } },
    ]);
    expect(call.data.discoveryStartedAt).toBeInstanceOf(Date);
  });

  it("fails to claim when the row is already locked (updateMany matches nothing)", async () => {
    prismaMocks.saaSProjectUpdateMany.mockResolvedValueOnce({ count: 0 });

    const claimed = await claimDiscoveryLock("project-1");

    expect(claimed).toBe(false);
  });
});

describe("runDiscoverySync", () => {
  it("runs syncOpportunities and records a DiscoveryRun on success", async () => {
    mockSyncOpportunities.mockResolvedValue({ discovered: 3, updated: 1, perPlatform: [] });

    const outcome = await runDiscoverySync(project, icp, { isAuto: false });

    expect(outcome.ran).toBe(true);
    expect(mockSyncOpportunities).toHaveBeenCalledTimes(1);
    expect(prismaMocks.discoveryRunCreate).toHaveBeenCalledTimes(1);
    const runData = prismaMocks.discoveryRunCreate.mock.calls[0][0].data;
    expect(runData.newCount).toBe(3);
    expect(runData.updatedCount).toBe(1);
    expect(runData.isAuto).toBe(false);
  });

  it("does not run syncOpportunities when the lock cannot be claimed (already in progress)", async () => {
    prismaMocks.saaSProjectUpdateMany.mockResolvedValueOnce({ count: 0 });

    const outcome = await runDiscoverySync(project, icp, { isAuto: false });

    expect(outcome).toEqual({ ran: false, reason: "locked" });
    expect(mockSyncOpportunities).not.toHaveBeenCalled();
  });

  it("prevents a second concurrent call for the same project once the first has claimed the lock", async () => {
    // Simulate the second call losing the race: its updateMany matches 0 rows.
    prismaMocks.saaSProjectUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // first call claims
      .mockResolvedValueOnce({ count: 0 }); // second call is locked out

    const [first, second] = await Promise.all([
      runDiscoverySync(project, icp, { isAuto: false }),
      runDiscoverySync(project, icp, { isAuto: true }),
    ]);

    const ranCount = [first, second].filter((o) => o.ran).length;
    expect(ranCount).toBe(1);
    expect(mockSyncOpportunities).toHaveBeenCalledTimes(1);
  });

  it("sets isAuto: true and updates lastAutoDiscoveryAt only for an automatic run", async () => {
    await runDiscoverySync(project, icp, { isAuto: true });

    const runData = prismaMocks.discoveryRunCreate.mock.calls[0][0].data;
    expect(runData.isAuto).toBe(true);
    const projectUpdateData = prismaMocks.saaSProjectUpdate.mock.calls[0][0].data;
    expect(projectUpdateData.lastAutoDiscoveryAt).toBeInstanceOf(Date);
  });

  it("does not touch lastAutoDiscoveryAt for a manual run", async () => {
    await runDiscoverySync(project, icp, { isAuto: false });

    const projectUpdateData = prismaMocks.saaSProjectUpdate.mock.calls[0][0].data;
    expect(projectUpdateData).not.toHaveProperty("lastAutoDiscoveryAt");
  });

  it("releases the lock even when syncOpportunities throws, so the project isn't stuck locked", async () => {
    mockSyncOpportunities.mockRejectedValue(new Error("unexpected crash"));

    await expect(runDiscoverySync(project, icp, { isAuto: true })).rejects.toThrow(
      "unexpected crash",
    );

    // The release call is the second updateMany (first was the claim).
    expect(prismaMocks.saaSProjectUpdateMany).toHaveBeenCalledTimes(2);
    const releaseCall = prismaMocks.saaSProjectUpdateMany.mock.calls[1][0];
    expect(releaseCall.data.discoveryStartedAt).toBeNull();
  });

  it("records per-platform failures via errorSummary, tagged by category", async () => {
    mockSyncOpportunities.mockResolvedValue({
      discovered: 0,
      updated: 0,
      perPlatform: [
        { platform: "STACKOVERFLOW", opportunities: 0, status: "RATE_LIMITED", error: "slow down" },
      ],
    });

    await runDiscoverySync(project, icp, { isAuto: true });

    const runData = prismaMocks.discoveryRunCreate.mock.calls[0][0].data;
    expect(runData.errorSummary).toContain("STACKOVERFLOW");
    expect(runData.errorSummary).toContain("Rate limited");
  });
});

describe("formatSyncFailures", () => {
  it("returns null when nothing failed", () => {
    expect(formatSyncFailures([{ platform: "GITHUB", opportunities: 1, status: "OK" }])).toBeNull();
  });
});
