"use client";

import type { ReactNode } from "react";
import { DISCOVERY_STEPS, usePrefersReducedMotion } from "./discovery-stage-tracker";

/**
 * The large, full-screen presentation of the same discovery tracker used
 * inline elsewhere — same steps, same `stepIndex` the caller already
 * computed via `useDiscoveryStageIndex`, same honesty guarantee (it never
 * shows a step as done before the caller says so). This component only
 * changes how big and how immersive the *presentation* is; it owns none of
 * the discovery request itself.
 */
function BigStepDot({
  completed,
  current,
  reducedMotion,
}: {
  completed: boolean;
  current: boolean;
  reducedMotion: boolean;
}) {
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center sm:h-10 sm:w-10">
      {current && !reducedMotion ? (
        <span
          aria-hidden="true"
          className="absolute h-full w-full animate-ping rounded-full bg-opportunity opacity-50"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={`relative h-6 w-6 rounded-full border-[3px] transition-colors duration-500 sm:h-7 sm:w-7 ${
          completed || current ? "border-opportunity bg-opportunity" : "border-border bg-surface"
        }`}
      />
    </span>
  );
}

export function DiscoveryFullScreen({
  stepIndex,
  children,
}: {
  stepIndex: number;
  children?: ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 py-12"
    >
      <p className="sr-only">
        {DISCOVERY_STEPS[stepIndex].label}. {DISCOVERY_STEPS[stepIndex].detail}.
      </p>

      <p className="mb-10 text-xs font-semibold tracking-[0.14em] text-muted uppercase sm:mb-16">
        Launchpad Catalyst · Discovery
      </p>

      {/* Mobile: large vertical tracker */}
      <ol aria-hidden="true" className="w-full max-w-sm space-y-8 sm:hidden">
        {DISCOVERY_STEPS.map((step, i) => (
          <li key={step.label} className="flex items-start gap-4">
            <BigStepDot completed={i < stepIndex} current={i === stepIndex} reducedMotion={reducedMotion} />
            <div className="pt-1">
              <p className={`text-base font-semibold ${i <= stepIndex ? "text-foreground" : "text-muted"}`}>
                {step.label}
              </p>
              {i === stepIndex ? <p className="mt-1 text-sm text-muted">{step.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop/tablet: large horizontal tracker */}
      <div aria-hidden="true" className="hidden w-full max-w-4xl sm:block">
        <ol className="flex items-center">
          {DISCOVERY_STEPS.map((step, i) => (
            <li
              key={step.label}
              className={`flex items-center ${i < DISCOVERY_STEPS.length - 1 ? "flex-1" : ""}`}
            >
              <BigStepDot completed={i < stepIndex} current={i === stepIndex} reducedMotion={reducedMotion} />
              {i < DISCOVERY_STEPS.length - 1 ? (
                <span
                  className={`mx-2 h-1 flex-1 rounded-full ${
                    i < stepIndex ? "bg-opportunity" : "bg-border"
                  } ${reducedMotion ? "" : "transition-colors duration-700"}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex">
          {DISCOVERY_STEPS.map((step, i) => (
            <p
              key={step.label}
              className={`flex-1 text-center text-sm font-semibold first:text-left last:text-right ${
                i <= stepIndex ? "text-foreground" : "text-muted"
              }`}
            >
              {step.label}
            </p>
          ))}
        </div>
        <p className="mt-4 text-center text-base text-muted">{DISCOVERY_STEPS[stepIndex].detail}</p>
      </div>

      {children ? <div className="mt-12 w-full max-w-sm text-center">{children}</div> : null}
    </div>
  );
}
