"use client";

import { useRef } from "react";

const TOPICS = [
  {
    title: "What Catalyst does",
    body: "Catalyst finds public conversations where people describe the problem your product solves, scores how good a fit each one is, and helps you reply well — without guessing where to look or spamming people.",
  },
  {
    title: "1. Create a project",
    body: "Each product you're building gets its own project. Add one from the project dropdown in the header — it only takes a product name and a short description to get started.",
  },
  {
    title: "2. Set up your business context",
    body: "In Strategy, describe who you're building for and what problem you solve. This drives what Catalyst searches for — the more specific it is, the more relevant your results will be.",
  },
  {
    title: "3. Find opportunities",
    body: 'Click "Find New Opportunities" on the Opportunities page. Catalyst scans GitHub, Hacker News and Stack Overflow for matching conversations, filters out noise, and ranks what\'s left by how strong a fit it is.',
  },
  {
    title: "4. Use response suggestions",
    body: "Open any opportunity to see a draft reply. It's a starting point you review and edit — Catalyst never posts anything on your behalf.",
  },
  {
    title: "Troubleshooting",
    body: "No results yet? Try broadening your Strategy description, or check Settings to confirm a platform isn't showing a connection error. Automatic discovery runs every few hours on its own, or you can run it manually any time.",
  },
];

export function HelpButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label="Help"
        title="Help"
        onClick={() => dialogRef.current?.showModal()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.5-2.4 1.9-2.4 3.5" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="help-dialog-title"
        className="m-auto w-full max-w-lg rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-foreground/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="help-dialog-title" className="text-base font-semibold text-foreground">
              How Launchpad Catalyst works
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="text-sm text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="space-y-4">
            {TOPICS.map((topic) => (
              <div key={topic.title}>
                <h3 className="text-sm font-semibold text-foreground">{topic.title}</h3>
                <p className="mt-1 text-sm text-muted">{topic.body}</p>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
