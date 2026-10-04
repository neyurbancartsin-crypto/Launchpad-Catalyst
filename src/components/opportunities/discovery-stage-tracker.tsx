"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Shared by every "discovery is running" trigger in the app (the Opportunities
 * page's "Find New Opportunities" and onboarding's "Find My Opportunities" —
 * two different server actions, same underlying discovery pipeline and the
 * same visual tracker) so the stage list and animation only exist in one
 * place.
 */
export const DISCOVERY_STEPS = [
  { label: "Finding conversations", detail: "Scanning for conversations related to your search" },
  { label: "Sources discovered", detail: "Checking relevant conversations across available sources" },
  { label: "Filtering signals", detail: "Removing noise and low-relevance conversations" },
  { label: "Analysing relevance", detail: "Identifying conversations that match your customer signals" },
  { label: "Best opportunities found", detail: "Your strongest conversations are ready" },
] as const;

/** Index of the last step the presentation layer may reach on its own. The
 * real final step only ever happens once the caller tells us the actual
 * request has completed. */
const LAST_AUTO_STEP = DISCOVERY_STEPS.length - 2;
const STEP_INTERVAL_MS = 1800;

function subscribeToReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * Drives the step index: advances through the first steps on a timer while
 * `isPending`, holding at "Analysing relevance" for as long as the real
 * request takes, and only ever reaching the final step when the caller
 * passes `completed: true` (i.e. the real operation actually finished).
 */
export function useDiscoveryStageIndex(isPending: boolean, completed: boolean): number {
  const [stepIndex, setStepIndex] = useState(0);

  // See the note in discovery-progress.tsx on why this runs during render
  // rather than in an effect (react-hooks/set-state-in-effect).
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  const [prevCompleted, setPrevCompleted] = useState(completed);

  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    if (isPending) setStepIndex(0);
  }
  if (completed !== prevCompleted) {
    setPrevCompleted(completed);
    if (completed) setStepIndex(DISCOVERY_STEPS.length - 1);
  }

  useEffect(() => {
    if (!isPending) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setStepIndex(Math.min(i, LAST_AUTO_STEP));
      if (i >= LAST_AUTO_STEP) clearInterval(interval);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPending]);

  return stepIndex;
}

function StepDot({
  completed,
  current,
  reducedMotion,
}: {
  completed: boolean;
  current: boolean;
  reducedMotion: boolean;
}) {
  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      {current && !reducedMotion ? (
        <span
          aria-hidden="true"
          className="absolute h-full w-full animate-ping rounded-full bg-opportunity opacity-50"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={`relative h-3 w-3 rounded-full border-2 ${
          completed || current ? "border-opportunity bg-opportunity" : "border-border bg-surface"
        }`}
      />
    </span>
  );
}

export function DiscoveryStageTracker({ stepIndex }: { stepIndex: number }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="sr-only">
        {DISCOVERY_STEPS[stepIndex].label}. {DISCOVERY_STEPS[stepIndex].detail}.
      </p>

      {/* Mobile: compact vertical tracker */}
      <ol className="space-y-3 sm:hidden">
        {DISCOVERY_STEPS.map((step, i) => (
          <li key={step.label} aria-hidden="true" className="flex items-start gap-3">
            <StepDot completed={i < stepIndex} current={i === stepIndex} reducedMotion={reducedMotion} />
            <div>
              <p className={`text-sm font-medium ${i <= stepIndex ? "text-foreground" : "text-muted"}`}>
                {step.label}
              </p>
              {i === stepIndex ? <p className="text-xs text-muted">{step.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop/tablet: horizontal tracker */}
      <div aria-hidden="true" className="hidden sm:block">
        <ol className="flex items-center">
          {DISCOVERY_STEPS.map((step, i) => (
            <li
              key={step.label}
              className={`flex items-center ${i < DISCOVERY_STEPS.length - 1 ? "flex-1" : ""}`}
            >
              <StepDot completed={i < stepIndex} current={i === stepIndex} reducedMotion={reducedMotion} />
              {i < DISCOVERY_STEPS.length - 1 ? (
                <span
                  className={`mx-1 h-0.5 flex-1 ${i < stepIndex ? "bg-opportunity" : "bg-border"} ${
                    reducedMotion ? "" : "transition-colors duration-700"
                  }`}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-2 flex">
          {DISCOVERY_STEPS.map((step, i) => (
            <p
              key={step.label}
              className={`flex-1 text-center text-xs font-medium first:text-left last:text-right ${
                i <= stepIndex ? "text-foreground" : "text-muted"
              }`}
            >
              {step.label}
            </p>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted">{DISCOVERY_STEPS[stepIndex].detail}</p>
      </div>
    </div>
  );
}
