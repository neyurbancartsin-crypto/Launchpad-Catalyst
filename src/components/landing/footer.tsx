import Link from "next/link";

export function LandingFooter() {
  return (
    <footer
      data-tone="dark"
      className="border-t border-landing-border-on-ink bg-landing-ink px-6 py-10 text-landing-on-ink-muted"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-landing-lime" aria-hidden="true" />
          <span className="text-sm font-medium text-landing-on-ink">Launchpad Catalyst</span>
        </div>
        <p className="text-sm">
          Find conversations where your potential customers are already talking.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hover:text-landing-on-ink">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-landing-on-ink">
            Sign up
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs">
        © {new Date().getFullYear()} Launchpad Catalyst.
      </p>
    </footer>
  );
}
