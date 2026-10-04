import { Eyebrow, Section } from "./ui";

const PLACES = [
  "a GitHub issue asking how anyone else handles this",
  "a Hacker News thread full of people hitting the same wall",
  "a Stack Overflow question nobody official ever answered",
];

export function ProblemSection() {
  return (
    <Section tone="dark">
      <Eyebrow tone="on-ink">The problem</Eyebrow>
      <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Your customers are already talking.
      </h2>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-landing-on-ink-muted">
        Right now, someone with exactly the problem you solve is describing it
        in public — in{" "}
        {PLACES.map((place, i) => (
          <span key={place}>
            {place}
            {i < PLACES.length - 1 ? ", " : "."}
          </span>
        ))}{" "}
        Most founders never see it, and the ones who do often respond in a
        way that reads as spam. Catalyst finds that moment and helps you
        answer it well.
      </p>
    </Section>
  );
}
