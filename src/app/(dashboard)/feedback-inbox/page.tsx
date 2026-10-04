import type { FeedbackStatus, FeedbackType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { updateFeedbackStatusAction } from "@/actions/feedback.actions";
import { Badge, Button, Card, PageHeader, Select } from "@/components/ui";

export const metadata = { title: "Feedback inbox · Launchpad Catalyst" };

const TYPE_LABELS: Record<FeedbackType, string> = {
  SUGGESTION: "Suggestion",
  FEATURE_REQUEST: "Feature request",
  BUG_REPORT: "Bug report",
  OTHER: "Other",
};

const STATUS_OPTIONS: FeedbackStatus[] = ["NEW", "REVIEWED", "PLANNED", "DONE"];

const STATUS_TONE: Record<FeedbackStatus, "brand" | "neutral" | "opportunity" | "success"> = {
  NEW: "brand",
  REVIEWED: "neutral",
  PLANNED: "opportunity",
  DONE: "success",
};

export default async function FeedbackInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Re-checked here even though the layout already hides the link from
  // non-admins — a direct URL visit must be blocked just as hard.
  await requireAdmin();

  const params = await searchParams;
  const status = single(params.status);
  const type = single(params.type);
  const q = single(params.q)?.trim();

  const where: Prisma.FeedbackWhereInput = {
    ...(status && status !== "ALL" ? { status: status as FeedbackStatus } : {}),
    ...(type && type !== "ALL" ? { type: type as FeedbackType } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { message: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, consentedCount] = await Promise.all([
    prisma.feedback.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.feedback.count(),
    prisma.feedback.count({ where: { consent: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Feedback inbox"
        description={`${total} submissions in total · ${consentedCount} consented to future updates`}
        action={
          <div className="flex gap-2">
            <a href="/api/admin/feedback/export">
              <Button variant="secondary">Export CSV</Button>
            </a>
            <a href="/api/admin/feedback/consented-emails">
              <Button variant="secondary">Export consented emails</Button>
            </a>
          </div>
        }
      />

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name, email or message"
              className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Status</span>
            <Select name="status" defaultValue={status ?? "ALL"} className="w-auto">
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Type</span>
            <Select name="type" defaultValue={type ?? "ALL"} className="w-auto">
              <option value="ALL">All types</option>
              {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Card>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No feedback matches these filters.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                      <Badge>{TYPE_LABELS[item.type]}</Badge>
                      {item.consent ? <Badge tone="opportunity">Consented</Badge> : null}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {item.name} · <span className="text-muted">{item.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.createdAt.toLocaleDateString()} {item.createdAt.toLocaleTimeString()}
                    </p>
                  </div>
                  <form action={updateFeedbackStatusAction}>
                    <input type="hidden" name="feedbackId" value={item.id} />
                    <Select name="status" defaultValue={item.status} className="w-auto">
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" className="ml-2">
                      Update
                    </Button>
                  </form>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
