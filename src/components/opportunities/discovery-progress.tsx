"use client";

import { useActionState, useEffect, useState } from "react";
import {
  refreshOpportunitiesAction,
  type RefreshOpportunitiesResult,
} from "@/actions/saas-project.actions";
import { Button } from "@/components/ui";
import { formatCooldown, manualDiscoveryAvailableAt } from "@/lib/discovery-cooldown";
import { useDiscoveryStageIndex } from "./discovery-stage-tracker";
import { DiscoveryFullScreen } from "./discovery-fullscreen";

/**
 * Clicking "Find New Opportunities" switches the whole screen to a focused,
 * full-screen discovery view (see DiscoveryFullScreen) rather than a small
 * inline tracker — the request itself is unchanged: still exactly one call
 * to `refreshOpportunitiesAction`, still gated on the real result before
 * ever claiming completion.
 *
 * The 6-hour cooldown itself is enforced server-side in
 * `refreshOpportunitiesAction` regardless of what this component shows —
 * `lastSyncedAt` here only drives the button's disabled/label state so the
 * founder isn't left wondering why nothing happened, it is never the actual
 * guard.
 */
export function DiscoveryProgress({
  variant = "primary",
  className,
  lastSyncedAt = null,
}: {
  variant?: "primary" | "secondary";
  className?: string;
  lastSyncedAt?: Date | null;
}) {
  const [state, formAction, isPending] = useActionState<RefreshOpportunitiesResult, FormData>(
    refreshOpportunitiesAction,
    { status: "idle" },
  );
  const [result, setResult] = useState<RefreshOpportunitiesResult | null>(null);

  // See discovery-stage-tracker.tsx for why this runs during render rather
  // than in a useEffect (react-hooks/set-state-in-effect).
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  const [prevState, setPrevState] = useState(state);

  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    if (isPending) setResult(null);
  }
  if (state !== prevState) {
    setPrevState(state);
    if (state.status !== "idle") setResult(state);
  }

  // Safety-net auto-dismiss, in case the user doesn't click "Continue".
  useEffect(() => {
    if (!result) return;
    const hide = setTimeout(() => setResult(null), 6000);
    return () => clearTimeout(hide);
  }, [result]);

  const stepIndex = useDiscoveryStageIndex(isPending, result?.status === "ok");
  const showFullScreen = isPending || result !== null;

  // Display-only — see the docblock above. Computed fresh on each render
  // (no live-ticking clock), which is accurate enough for a value measured
  // in hours; a page reload or the next natural re-render keeps it current.
  const now = new Date();
  const cooldownUntil =
    result?.status === "cooldown" ? new Date(result.availableAt) : manualDiscoveryAvailableAt(lastSyncedAt);
  const inCooldown = cooldownUntil !== null && cooldownUntil > now;

  return (
    <div className={className}>
      <form action={formAction}>
        <Button
          type="submit"
          variant={variant}
          disabled={isPending || inCooldown}
          title={
            inCooldown
              ? `Your next opportunity refresh will be available in about ${formatCooldown(cooldownUntil, now)}.`
              : undefined
          }
        >
          {inCooldown ? `Refresh available in ${formatCooldown(cooldownUntil, now)}` : "Find New Opportunities"}
        </Button>
      </form>

      {showFullScreen ? (
        <DiscoveryFullScreen stepIndex={stepIndex}>
          {result?.status === "ok" ? (
            <>
              <p className="text-lg font-semibold text-foreground">
                {result.newCount} new {result.newCount === 1 ? "opportunity" : "opportunities"} found
              </p>
              <Button className="mt-5" onClick={() => setResult(null)}>
                View opportunities
              </Button>
            </>
          ) : null}
          {result?.status === "locked" ? (
            <>
              <p className="text-sm text-muted">
                A discovery run is already in progress for this project — try again in a moment.
              </p>
              <Button variant="secondary" className="mt-5" onClick={() => setResult(null)}>
                Back to opportunities
              </Button>
            </>
          ) : null}
          {result?.status === "cooldown" ? (
            <>
              <p className="text-sm text-muted">
                Your next opportunity refresh will be available in about{" "}
                {formatCooldown(new Date(result.availableAt), now)}. New conversations will be
                discovered automatically before then if automatic discovery is on.
              </p>
              <Button variant="secondary" className="mt-5" onClick={() => setResult(null)}>
                Back to opportunities
              </Button>
            </>
          ) : null}
        </DiscoveryFullScreen>
      ) : null}
    </div>
  );
}
