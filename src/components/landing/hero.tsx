import { Eyebrow, LandingButton } from "./ui";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <div className="grid grid-cols-1 items-center gap-16 px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 lg:grid-cols-[1fr_1.2fr]">
      <div className="mx-auto max-w-xl lg:mx-0">
        <Eyebrow>Customer conversation intelligence</Eyebrow>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-landing-ink sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
          Find conversations where your potential customers are already talking.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-landing-muted">
          Launchpad Catalyst discovers the conversations where people are
          describing the problem you solve, helps you understand what they
          actually need, and tells you whether — and how — to respond.
          Nothing posts on your behalf.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <LandingButton href="/signup">Start Finding Conversations</LandingButton>
          <LandingButton href="#workflow" variant="secondary">
            See How It Works
          </LandingButton>
        </div>
      </div>

      <HeroVisual />
    </div>
  );
}
