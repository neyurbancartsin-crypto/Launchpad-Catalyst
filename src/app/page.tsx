import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui";

const LOOP = [
  ["Find", "Relevant communities, posts and comments across Reddit, X and LinkedIn."],
  ["Understand", "Who has your problem, how strong their intent is, and whether to promote."],
  ["Act", "A recommended action and a value-first draft you post yourself."],
  ["Track", "Log what happened: visits, signups, activated and paying users."],
  ["Learn", "See which channel, topic and conversation type actually works."],
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-brand">Launchpad Catalyst</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Find the right conversations. Take the right actions. Get your first
        users.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted">
        An acquisition system for early-stage SaaS founders: identify your ideal
        customers, discover the conversations worth joining, understand which
        opportunities are real, and learn what is actually working.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup">
          <Button>Get started</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Sign in</Button>
        </Link>
      </div>

      <ol className="mt-12 space-y-3 border-t border-border pt-8">
        {LOOP.map(([step, detail], index) => (
          <li key={step} className="flex gap-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {index + 1}
            </span>
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{step}.</span>{" "}
              {detail}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
