import { Eyebrow, LimeDot, Section } from "./ui";

const GUARANTEES = [
  "Nothing is ever posted without you reviewing it first.",
  "No automated replies, DMs or mass outreach of any kind.",
  "You decide which conversations are worth your time.",
];

export function FounderControlSection() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Eyebrow tone="ink">Always in your hands</Eyebrow>
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-landing-ink sm:text-4xl">
          The founder remains in control.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-landing-muted">
          Catalyst finds and prepares — it doesn&rsquo;t act on your behalf.
          Every reply you send is one you chose to send.
        </p>
        <ul className="mx-auto mt-10 max-w-md space-y-4 text-left">
          {GUARANTEES.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <LimeDot className="mt-2 shrink-0" />
              <span className="text-base text-landing-ink">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
