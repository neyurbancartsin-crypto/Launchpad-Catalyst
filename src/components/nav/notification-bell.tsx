"use client";

import Link from "next/link";
import type { Platform } from "@prisma/client";
import { Badge, Button } from "@/components/ui";
import { PLATFORM_LABELS } from "@/lib/adapters/registry";
import { relativeTime } from "@/components/opportunities/opportunity-bits";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications.actions";

interface NotificationItem {
  id: string;
  read: boolean;
  createdAt: Date;
  opportunity: { id: string; title: string; platform: Platform };
}

/**
 * A native `<details>` disclosure instead of a custom popover library —
 * open/close and outside-click-to-close come for free from the browser, no
 * extra dependency or client state needed for that part.
 */
export function NotificationBell({
  projectId,
  unreadCount,
  notifications,
}: {
  projectId: string;
  unreadCount: number;
  notifications: NotificationItem[];
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <BellIcon />
        {unreadCount > 0 ? (
          <Badge tone="brand" className="-ml-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                Mark all read
              </Button>
            </form>
          ) : null}
        </div>

        <ul className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">
              No new opportunities yet.
            </li>
          ) : (
            notifications.map((notification) => (
              <li key={notification.id} className="border-b border-border last:border-0">
                <Link
                  href={`/opportunities/${notification.opportunity.id}`}
                  onClick={() => {
                    if (!notification.read) void markNotificationReadAction(notification.id);
                  }}
                  className={`block px-4 py-3 text-sm hover:bg-surface-muted ${
                    notification.read ? "" : "bg-brand-soft/40"
                  }`}
                >
                  <p className="font-medium text-foreground line-clamp-2">
                    {notification.opportunity.title}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {PLATFORM_LABELS[notification.opportunity.platform]} ·{" "}
                    {relativeTime(notification.createdAt)}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </details>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
