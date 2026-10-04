import { prisma } from "@/lib/db";

/**
 * Creates one notification per genuinely new opportunity found by an
 * automatic discovery run. `opportunityId` is `@unique` on `Notification`,
 * and `skipDuplicates` makes this call idempotent at the database level —
 * calling it twice for the same opportunity (a retried or overlapping cron
 * invocation) inserts the row at most once, with no error either way.
 */
export async function createNotificationsForNewOpportunities(
  userId: string,
  projectId: string,
  opportunityIds: string[],
): Promise<void> {
  if (opportunityIds.length === 0) return;

  await prisma.notification.createMany({
    data: opportunityIds.map((opportunityId) => ({ userId, projectId, opportunityId })),
    skipDuplicates: true,
  });
}

export function getUnreadNotificationCount(userId: string, projectId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, projectId, read: false } });
}

export function listNotifications(userId: string, projectId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId, projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      read: true,
      createdAt: true,
      opportunity: {
        select: { id: true, title: true, platform: true },
      },
    },
  });
}
