import { prisma } from "@/lib/db";
import { getSessionUserId, getActiveProject } from "@/lib/project";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/actions/account.actions";
import { logoutAction, resendVerificationAction } from "@/actions/auth.actions";
import { deleteProjectAction } from "@/actions/saas-project.actions";
import { getMailer } from "@/lib/mailer";
import { VerifyEmailCard } from "@/components/settings/verify-email-card";
import { DeleteProjectForm } from "@/components/settings/delete-project-form";
import {
  getConnectionStatuses,
  getDeferredPlatformInfo,
  PLATFORM_LABELS,
} from "@/lib/adapters/registry";
import { getAIProvider } from "@/lib/ai/registry";
import {
  ProfileForm,
  PasswordForm,
} from "@/components/settings/account-forms";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings · Launchpad Catalyst" };

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  const [user, project, statuses] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true, emailVerified: true },
    }),
    getActiveProject(),
    getConnectionStatuses(),
  ]);
  const deferredPlatforms = getDeferredPlatformInfo();

  const ai = getAIProvider();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, and what Launchpad Catalyst is currently connected to."
      />

      <div className="space-y-8">
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Account</h2>

          <Card>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-brand">
                {initialsOf(user.name, user.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.name || user.email}
                </p>
                <p className="truncate text-sm text-muted">{user.email}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Joined{" "}
                  {user.createdAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </Card>

          <VerifyEmailCard
            verified={Boolean(user.emailVerified)}
            consoleOnly={getMailer().isConsoleOnly}
            action={resendVerificationAction}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Profile" />
              <ProfileForm
                name={user.name ?? ""}
                email={user.email}
                action={updateProfileAction}
              />
            </Card>

            <Card>
              <CardHeader title="Password" />
              <PasswordForm action={changePasswordAction} />
            </Card>
          </div>

          <Card>
            <CardHeader title="Session" />
            <form action={logoutAction}>
              <Button variant="secondary" type="submit">
                Log out
              </Button>
            </form>
          </Card>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Platforms</h2>

          <Card>
            <CardHeader
              title="Active platforms"
              description="Discovery runs against these three. Status only ever shows what the connection actually returns."
            />
          <ul className="space-y-3">
            {statuses.map((status) => (
              <li
                key={status.platform}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PLATFORM_LABELS[status.platform]}
                    </h3>
                    <Badge
                      tone={
                        status.status === "CONNECTED"
                          ? "success"
                          : status.status === "ERROR"
                            ? "danger"
                            : "demo"
                      }
                    >
                      {status.status === "DEMO" ? "Demo data" : status.status.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">{status.message}</p>
                </div>
                <Button variant="secondary" disabled title="Configured via environment variables">
                  Configure
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Live discovery for GitHub, Hacker News and Stack Overflow is
            configured with environment variables, not from this page. Until
            a platform is set to live, discovery runs on bundled demo
            fixtures and is labelled as such everywhere it appears.
          </p>
        </Card>

          <Card>
            <CardHeader
              title="Deferred platforms"
              description="Not part of the current discovery run. Their code and any past data stay intact — nothing here was deleted, only paused."
            />
            <ul className="space-y-3">
              {deferredPlatforms.map(({ platform, label }) => (
                <li
                  key={platform}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4"
                >
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  <Badge tone="neutral">Deferred</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">AI</h2>

          <Card>
            <CardHeader
              title="AI analysis"
              description="What generates your ICP, scoring rationale and response drafts. Normal discovery and scoring never call it — only onboarding, Analyze Conversation, Generate Response, reports and experiments do, on request."
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground">
                Provider: <code className="text-xs">{ai.id}</code>
              </span>
              {ai.isDemoProvider ? <Badge tone="demo">Demo engine</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted">
              {ai.isDemoProvider
                ? "Analysis comes from the built-in demo engine, which derives its output from what you entered rather than a language model. Opportunity scores are computed by the same deterministic scoring rules a real provider would use, so those numbers do not change when you connect one."
                : "A live AI provider is configured."}
            </p>
          </Card>
        </section>

        {project ? (
          <section className="space-y-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Workspace
            </h2>

            <Card>
              <CardHeader title="Project" />
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted">Name</dt>
                  <dd className="text-foreground">{project.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted">Website</dt>
                  <dd className="truncate text-foreground">
                    {project.website || <span className="text-muted">Not provided</span>}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted">Category</dt>
                  <dd className="text-foreground">{project.category}</dd>
                </div>
              </dl>
            </Card>
          </section>
        ) : null}

        {project ? (
          <section className="space-y-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-danger">
              Danger Zone
            </h2>

            <Card className="border-[#f0c4c1]">
              <CardHeader
                title="Delete this project"
                description="Permanent. Only you can delete your own projects."
              />
              <DeleteProjectForm
                projectId={project.id}
                projectName={project.name}
                action={deleteProjectAction}
              />
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
