import { LandingButton, Section } from "./ui";

export function FinalCta() {
  return (
    <Section tone="dark" className="text-center">
      <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Your next customer is mid-conversation right now.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-lg text-landing-on-ink-muted">
        Set up Catalyst in a few minutes and see what it finds for your product.
      </p>
      <div className="mt-9 flex justify-center">
        <LandingButton href="/signup" variant="lime">
          Start Finding Conversations
        </LandingButton>
      </div>
    </Section>
  );
}
