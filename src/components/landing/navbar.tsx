import Link from "next/link";
import { LandingButton } from "./ui";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-landing-border bg-landing-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight whitespace-nowrap text-landing-ink"
        >
          Launchpad Catalyst
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="hidden px-3 py-2 text-sm font-medium text-landing-ink/80 hover:text-landing-ink sm:inline-block"
          >
            Sign in
          </Link>
          <LandingButton href="/signup" className="px-3.5 py-2 text-xs sm:px-4 sm:text-sm">
            <span className="sm:hidden">Start Finding</span>
            <span className="hidden sm:inline">Start Finding Conversations</span>
          </LandingButton>
        </nav>
      </div>
    </header>
  );
}
