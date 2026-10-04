import { Eyebrow, Section } from "./ui";

const NODES = ["Find", "Analyse", "Recommend", "Draft", "You post"];

export function WorkflowDiagram() {
  return (
    <Section tone="light">
      <div className="text-center">
        <div className="flex justify-center">
          <Eyebrow tone="ink">The full loop</Eyebrow>
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-landing-ink sm:text-4xl">
          From conversation to customer, one deliberate step at a time.
        </h2>
      </div>

      <div className="relative mt-16">
        <div
          aria-hidden="true"
          className="absolute top-4 right-0 left-0 hidden h-px bg-landing-border sm:block"
        />
        <ol className="relative grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-5 sm:gap-x-4">
          {NODES.map((node, i) => (
            <li key={node} className="flex flex-col items-center text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                  i === NODES.length - 1
                    ? "border-landing-ink bg-landing-ink text-landing-on-ink"
                    : "border-landing-lime bg-landing-bg text-landing-ink"
                }`}
              >
                {i + 1}
              </span>
              <span className="mt-3 text-sm font-medium text-landing-ink">{node}</span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
