import { refreshOpportunitiesAction, toggleAutoDiscoveryAction } from "@/actions/saas-project.actions";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { FindOpportunitiesButton } from "./find-opportunities-button";
import { relativeTime } from "./opportunity-bits";

interface RunSummary {
  id: string;
  runAt: Date;
  newCount: number;
  updatedCount: number;
}

/**
 * Phase 4: lets the founder see when this project was last searched and run
 * discovery again — repeatable, no artificial limit — without building a
 * full analytics system. Backed by `DiscoveryRun`, the simplest persistence
 * that supports "last searched" plus a short history.
 *
 * Also shows the minimum needed to understand background/automatic
 * discovery (Phase: Background Discovery) — on/off status, interval, and
 * the last automatic run's result, reusing the same `DiscoveryRun` data.
 */
export function DiscoveryPanel({
  projectId,
  lastSyncedAt,
  runs,
  autoDiscoveryEnabled,
  discoveryIntervalHours,
  lastAutoDiscoveryAt,
  lastAutoNewCount,
}: {
  projectId: string;
  lastSyncedAt: Date | null;
  runs: RunSummary[];
  autoDiscoveryEnabled: boolean;
  discoveryIntervalHours: number;
  lastAutoDiscoveryAt: Date | null;
  lastAutoNewCount: number | null;
}) {
  const [latest, ...previous] = runs;

  return (
    <Card className="mb-6">
      <CardHeader
        title="Discovery"
        description={
          lastSyncedAt
            ? `Last searched: ${lastSyncedAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}, ${lastSyncedAt.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })} (${relativeTime(lastSyncedAt)})`
            : "This project hasn't been searched yet."
        }
      />

      {latest ? (
        <p className="text-sm text-foreground">
          <span className="font-medium">{latest.newCount}</span>{" "}
          {latest.newCount === 1 ? "new opportunity" : "new opportunities"} found last run
          {latest.updatedCount > 0
            ? ` · ${latest.updatedCount} existing ${latest.updatedCount === 1 ? "one" : "ones"} refreshed`
            : ""}
        </p>
      ) : (
        <p className="text-sm text-muted">
          Run discovery to find conversations that match your product.
        </p>
      )}

      <form action={refreshOpportunitiesAction} className="mt-3">
        <FindOpportunitiesButton />
      </form>

      {previous.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">Previous</p>
          <ul className="space-y-1 text-xs text-muted">
            {previous.map((run) => (
              <li key={run.id}>
                {run.runAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                {run.newCount} new
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Automatic discovery</span>
          <Badge tone={autoDiscoveryEnabled ? "success" : "neutral"}>
            {autoDiscoveryEnabled ? "● On" : "Off"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {autoDiscoveryEnabled
            ? `Checks for new customer conversations every ~${discoveryIntervalHours} hours.`
            : "Not running automatically. Use Find New Opportunities to search manually."}
        </p>
        {autoDiscoveryEnabled && lastAutoDiscoveryAt ? (
          <p className="mt-1 text-xs text-muted">
            Last automatic search: {relativeTime(lastAutoDiscoveryAt)}
            {lastAutoNewCount !== null
              ? ` · ${lastAutoNewCount} new ${lastAutoNewCount === 1 ? "opportunity" : "opportunities"} found`
              : ""}
          </p>
        ) : null}
        <form action={toggleAutoDiscoveryAction} className="mt-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="enabled" value={autoDiscoveryEnabled ? "false" : "true"} />
          <Button type="submit" variant="secondary">
            {autoDiscoveryEnabled ? "Turn off automatic discovery" : "Turn on automatic discovery"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
