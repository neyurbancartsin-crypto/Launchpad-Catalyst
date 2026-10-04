import Link from "next/link";
import { logoutAction } from "@/actions/auth.actions";

/** A native <details> disclosure, same pattern as the notification bell —
 * open/close and outside-click-to-dismiss come from the browser for free. */
export function ProfileMenu({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <details className="relative shrink-0">
      <summary
        aria-label="Account"
        title={email}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background [&::-webkit-details-marker]:hidden"
      >
        {initial}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-lg">
        <p className="truncate px-2 py-1.5 text-sm text-muted">{email}</p>
        {isAdmin ? (
          <Link
            href="/feedback-inbox"
            className="block rounded-lg px-2 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Feedback inbox
          </Link>
        ) : null}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}
