import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSessionUserId } from "@/lib/project";
import { logoutAction } from "@/actions/auth.actions";
import { Sidebar } from "@/components/nav/sidebar";
import { Button } from "@/components/ui";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Also confirms the account still exists behind the JWT.
  await getSessionUserId();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="text-sm font-semibold">
            Launchpad Catalyst
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {session.user.email}
            </span>
            <form action={logoutAction}>
              <Button variant="secondary" type="submit">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 md:flex-row">
        <aside className="md:w-48 md:shrink-0">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
