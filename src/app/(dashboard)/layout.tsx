import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getActiveProject, getSessionUserId, getUserProjects } from "@/lib/project";
import { getUnreadNotificationCount, listNotifications } from "@/lib/notifications";
import { switchProjectAction } from "@/actions/saas-project.actions";
import { Sidebar } from "@/components/nav/sidebar";
import { ProjectSwitcher } from "@/components/nav/project-switcher";
import { NotificationBell } from "@/components/nav/notification-bell";
import { HelpButton } from "@/components/nav/help-button";
import { ProfileMenu } from "@/components/nav/profile-menu";
import { FeedbackMascot } from "@/components/feedback/feedback-mascot";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Also confirms the account still exists behind the JWT.
  await getSessionUserId();

  const [projects, activeProject] = await Promise.all([
    getUserProjects(),
    getActiveProject(),
  ]);

  const [unreadCount, notifications] = activeProject
    ? await Promise.all([
        getUnreadNotificationCount(session.user.id, activeProject.id),
        listNotifications(session.user.id, activeProject.id),
      ])
    : [0, []];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="shrink-0 text-sm font-semibold">
            Launchpad Catalyst
          </Link>
          {/* Exactly four elements: project switcher (Add Project lives
              inside it), help, notifications, profile/account. Scrolls
              within itself on narrow screens rather than stretching the
              whole page, same pattern as the sidebar's mobile nav. */}
          <div className="flex items-center gap-2 overflow-x-auto sm:gap-3">
            <ProjectSwitcher
              projects={projects}
              activeProjectId={activeProject?.id ?? null}
              switchAction={switchProjectAction}
            />
            <HelpButton />
            {activeProject ? (
              <NotificationBell
                projectId={activeProject.id}
                unreadCount={unreadCount}
                notifications={notifications}
              />
            ) : null}
            <ProfileMenu
              email={session.user.email ?? ""}
              isAdmin={isAdminEmail(session.user.email)}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 md:flex-row">
        <aside className="md:w-48 md:shrink-0">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <FeedbackMascot
        defaultName={session.user.name ?? ""}
        defaultEmail={session.user.email ?? ""}
      />
    </div>
  );
}
