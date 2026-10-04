import type { ReactNode } from "react";
import { Eyebrow, MockCard, PillTag, Section } from "./ui";

function FindVisual() {
  return (
    <MockCard className="space-y-3">
      <p className="text-xs font-semibold tracking-wide text-landing-muted uppercase">
        New opportunities
      </p>
      {[
        { title: "How do teams handle flaky CI tests?", source: "GitHub", score: 82 },
        { title: "Any tool for triaging support tickets?", source: "Hacker News", score: 67 },
      ].map((row) => (
        <div
          key={row.title}
          className="flex items-center justify-between gap-3 rounded-xl border border-landing-border px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-landing-ink">{row.title}</p>
            <p className="mt-0.5 text-xs text-landing-muted">{row.source}</p>
          </div>
          <PillTag tone="lime">{row.score}/100</PillTag>
        </div>
      ))}
    </MockCard>
  );
}

function AnalyseVisual() {
  const rows = [
    { label: "Problem match", value: "Strong" },
    { label: "Customer intent", value: "High" },
    { label: "Promotion risk", value: "Low" },
  ];
  return (
    <MockCard className="space-y-3">
      <p className="text-xs font-semibold tracking-wide text-landing-muted uppercase">
        Context analysis
      </p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between text-sm">
          <span className="text-landing-muted">{row.label}</span>
          <span className="font-medium text-landing-ink">{row.value}</span>
        </div>
      ))}
    </MockCard>
  );
}

function RecommendVisual() {
  return (
    <MockCard>
      <p className="text-xs font-semibold tracking-wide text-landing-muted uppercase">
        Recommended action
      </p>
      <p className="mt-2 text-sm font-medium text-landing-ink">
        Share your experience — don&rsquo;t pitch.
      </p>
      <p className="mt-1.5 text-sm text-landing-muted">
        Strong problem match and real intent, in a community that&rsquo;s open
        to product mentions when they&rsquo;re genuinely useful.
      </p>
      <div className="mt-3">
        <PillTag tone="lime">Worth reviewing</PillTag>
      </div>
    </MockCard>
  );
}

function DraftVisual() {
  return (
    <MockCard>
      <p className="text-xs font-semibold tracking-wide text-landing-muted uppercase">
        Response draft
      </p>
      <p className="mt-2 rounded-xl bg-landing-surface p-3 text-sm leading-relaxed text-landing-ink">
        &ldquo;We ran into this too — ended up building a small check for it.
        Happy to share what worked if useful.&rdquo;
      </p>
      <p className="mt-3 text-xs font-medium text-landing-muted">
        You review, edit and post it yourself — Catalyst never posts for you.
      </p>
    </MockCard>
  );
}

const STEPS: {
  index: string;
  title: string;
  description: string;
  visual: ReactNode;
}[] = [
  {
    index: "01",
    title: "Find",
    description:
      "Catalyst continuously checks GitHub, Hacker News and Stack Overflow for conversations that match your product — scored and ranked, not a raw keyword feed.",
    visual: <FindVisual />,
  },
  {
    index: "02",
    title: "Analyse",
    description:
      "Every conversation is read for what it actually says: how strong the problem match is, how real the buying intent is, and how welcome a product mention would be here.",
    visual: <AnalyseVisual />,
  },
  {
    index: "03",
    title: "Recommend",
    description:
      "Catalyst tells you whether a conversation is worth your time, and what kind of response makes sense — before you spend a minute reading the thread.",
    visual: <RecommendVisual />,
  },
  {
    index: "04",
    title: "Draft",
    description:
      "Get a value-first response you can review and edit. It's assistance, not automation — you decide what, if anything, gets posted.",
    visual: <DraftVisual />,
  },
];

export function WorkflowSteps() {
  return (
    <>
      {STEPS.map((step, i) => (
        <Section
          key={step.index}
          id={i === 0 ? "workflow" : undefined}
          tone={i === 2 ? "dark" : "light"}
        >
          <div
            className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <Eyebrow tone={i === 2 ? "on-ink" : "ink"}>
                Step {step.index} · {step.title}
              </Eyebrow>
              <h3
                className={`mt-4 text-3xl font-semibold tracking-tight sm:text-4xl ${
                  i === 2 ? "text-landing-on-ink" : "text-landing-ink"
                }`}
              >
                {step.title}
              </h3>
              <p
                className={`mt-5 max-w-md text-base leading-relaxed ${
                  i === 2 ? "text-landing-on-ink-muted" : "text-landing-muted"
                }`}
              >
                {step.description}
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm">{step.visual}</div>
          </div>
        </Section>
      ))}
    </>
  );
}
