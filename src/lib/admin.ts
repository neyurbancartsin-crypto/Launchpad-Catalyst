import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * The feedback inbox is owner-only. Launchpad Catalyst has no team/role
 * concept anywhere else in the schema, so a `User.role` column would be new
 * surface area for exactly one permission check — an env-var allowlist of
 * owner emails is the minimal mechanism that's actually appropriate for a
 * single-founder product, and it works the same locally and on Vercel.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * Guards both the inbox page and every server action it calls — never rely
 * on the page-level check alone, since a server action can be invoked
 * directly regardless of which page rendered the form that normally calls it.
 *
 * Uses `notFound()` rather than redirecting to login/dashboard: a non-owner
 * (including a logged-out visitor) sees a plain 404, which doesn't confirm
 * that an admin feature exists at this URL at all.
 */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !isAdminEmail(email)) {
    notFound();
  }
  return { id: session.user.id, email: email! };
}
