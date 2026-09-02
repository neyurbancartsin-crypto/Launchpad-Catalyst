import { prisma } from "@/lib/db";
import { getSessionUserId, getActiveProject } from "@/lib/project";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/actions/account.actions";
import { logoutAction, resendVerificationAction } from "@/actions/auth.actions";
import { getMailer } from "@/lib/mailer";
import { VerifyEmailCard } from "@/components/settings/verify-email-card";
import {
  getConnectionStatuses,
  PLATFORM_LABELS,
} from "@/lib/adapters/registry";
import { getAIProvider } from "@/lib/ai/registry";
import {
  ProfileForm,
  PasswordForm,
} from "@/components/settings/account-forms";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings · Launchpad Catalyst" };

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

  const ai = getAIProvider();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, and what Launchpad Catalyst is currently connected to."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Platform connections"
            description="Discovery only ever shows what these connections actually return."
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
                <Button variant="secondary" disabled title="Requires API credentials">
                  Connect
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Connecting a platform requires official API credentials and is not
            available yet. Until then, discovery runs on bundled demo fixtures
            and is labelled as such everywhere it appears.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="AI analysis"
            description="What generates your ICP, scoring rationale and response drafts."
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

        {project ? (
          <Card>
            <CardHeader title="Project" />
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-muted">Name</dt>
                <dd className="text-foreground">{project.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-muted">Website</dt>
                <dd className="truncate text-foreground">{project.website}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-muted">Category</dt>
                <dd className="text-foreground">{project.category}</dd>
              </div>
            </dl>
          </Card>
        ) : null}

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
      </div>
    </>
  );
}
