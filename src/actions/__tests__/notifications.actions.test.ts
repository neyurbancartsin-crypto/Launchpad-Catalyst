import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionUserId, prismaMocks } = vi.hoisted(() => ({
  mockGetSessionUserId: vi.fn(),
  prismaMocks: {
    notificationUpdateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { updateMany: prismaMocks.notificationUpdateMany },
  },
}));

vi.mock("@/lib/project", () => ({
  getSessionUserId: mockGetSessionUserId,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { markNotificationReadAction, markAllNotificationsReadAction } = await import(
  "../notifications.actions"
);

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUserId.mockResolvedValue("user-1");
  prismaMocks.notificationUpdateMany.mockResolvedValue({ count: 1 });
});

describe("markNotificationReadAction", () => {
  it("marks the notification read, scoped to the signed-in user", async () => {
    await markNotificationReadAction("notif-1");

    expect(prismaMocks.notificationUpdateMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-1" },
      data: { read: true },
    });
  });

  it("matches zero rows (does not throw) when the notification belongs to another user", async () => {
    prismaMocks.notificationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(markNotificationReadAction("someone-elses-notif")).resolves.not.toThrow();
    // The ownership check is the WHERE clause itself, not a separate lookup.
    expect(prismaMocks.notificationUpdateMany).toHaveBeenCalledWith({
      where: { id: "someone-elses-notif", userId: "user-1" },
      data: { read: true },
    });
  });
});

describe("markAllNotificationsReadAction", () => {
  it("marks every unread notification for the user+project as read", async () => {
    await markAllNotificationsReadAction(formData({ projectId: "project-1" }));

    expect(prismaMocks.notificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", projectId: "project-1", read: false },
      data: { read: true },
    });
  });
});
