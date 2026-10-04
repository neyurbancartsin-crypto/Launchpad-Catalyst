"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/project";

/**
 * Scoped by `userId` in the `WHERE` clause itself (not a preceding `if`), so
 * a notification id that belongs to another user simply matches zero rows
 * instead of being markable by anyone who can guess an id.
 */
export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const userId = await getSessionUserId();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  const projectId = String(formData.get("projectId") ?? "");

  await prisma.notification.updateMany({
    where: { userId, projectId, read: false },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}
