import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMocks } = vi.hoisted(() => ({
  prismaMocks: {
    notificationCreateMany: vi.fn(),
    notificationCount: vi.fn(),
    notificationFindMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      createMany: prismaMocks.notificationCreateMany,
      count: prismaMocks.notificationCount,
      findMany: prismaMocks.notificationFindMany,
    },
  },
}));

const { createNotificationsForNewOpportunities, getUnreadNotificationCount, listNotifications } =
  await import("../notifications");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.notificationCreateMany.mockResolvedValue({ count: 0 });
});

describe("createNotificationsForNewOpportunities", () => {
  it("creates one notification per new opportunity, scoped to the owning user and project", async () => {
    await createNotificationsForNewOpportunities("user-1", "project-1", ["opp-1", "opp-2"]);

    expect(prismaMocks.notificationCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", projectId: "project-1", opportunityId: "opp-1" },
        { userId: "user-1", projectId: "project-1", opportunityId: "opp-2" },
      ],
      skipDuplicates: true,
    });
  });

  it("does nothing when there are no new opportunities — no empty-array round trip", async () => {
    await createNotificationsForNewOpportunities("user-1", "project-1", []);

    expect(prismaMocks.notificationCreateMany).not.toHaveBeenCalled();
  });

  it("relies on skipDuplicates (backed by the unique opportunityId constraint) so a retried or overlapping call never double-inserts", async () => {
    // Simulates a cron retry: the same opportunity id is submitted twice
    // across two separate calls. The uniqueness guarantee lives in the
    // database constraint + skipDuplicates, not in this function re-checking
    // state itself — this test documents that every call always asks for it.
    await createNotificationsForNewOpportunities("user-1", "project-1", ["opp-1"]);
    await createNotificationsForNewOpportunities("user-1", "project-1", ["opp-1"]);

    expect(prismaMocks.notificationCreateMany).toHaveBeenCalledTimes(2);
    for (const call of prismaMocks.notificationCreateMany.mock.calls) {
      expect(call[0].skipDuplicates).toBe(true);
    }
  });
});

describe("getUnreadNotificationCount", () => {
  it("scopes the count to the given user and project, unread only", async () => {
    prismaMocks.notificationCount.mockResolvedValue(3);

    const count = await getUnreadNotificationCount("user-1", "project-1");

    expect(count).toBe(3);
    expect(prismaMocks.notificationCount).toHaveBeenCalledWith({
      where: { userId: "user-1", projectId: "project-1", read: false },
    });
  });
});

describe("listNotifications", () => {
  it("scopes the list to the given user and project", async () => {
    prismaMocks.notificationFindMany.mockResolvedValue([]);

    await listNotifications("user-1", "project-1");

    const call = prismaMocks.notificationFindMany.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-1", projectId: "project-1" });
  });
});
