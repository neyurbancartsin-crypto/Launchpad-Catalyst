import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type LandingButtonVariant = "primary" | "secondary" | "ghost-on-ink" | "lime";

const VARIANT_CLASS: Record<LandingButtonVariant, string> = {
  primary:
    "bg-landing-ink text-landing-on-ink hover:bg-landing-ink-soft focus-visible:outline-landing-ink",
  secondary:
    "border border-landing-ink/15 bg-transparent text-landing-ink hover:border-landing-ink/40 hover:bg-landing-ink/[0.03]",
  "ghost-on-ink":
    "border border-landing-border-on-ink text-landing-on-ink hover:border-landing-lime hover:text-landing-lime",
  // Reserved for the single highest-impact moment on the page (the closing
  // CTA) — a filled lime button everywhere would read as neon, not premium.
  lime: "bg-landing-lime text-landing-lime-ink hover:brightness-95",
};

/** Landing-only button — the dashboard keeps its own `Button` in `components/ui`. */
export function LandingButton({
  variant = "primary",
  className,
  href,
  children,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  variant?: LandingButtonVariant;
  href?: string;
  children: ReactNode;
}) {
  const classes = cx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-medium transition-colors duration-150",
    VARIANT_CLASS[variant],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

/** A small lime dot used as the recurring "signature accent" thread between sections. */
export function LimeDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block h-1.5 w-1.5 rounded-full bg-landing-lime", className)}
    />
  );
}

export function Eyebrow({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: "ink" | "on-ink";
}) {
  return (
    <p
      className={cx(
        "flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase",
        tone === "ink" ? "text-landing-muted" : "text-landing-on-ink-muted",
      )}
    >
      <LimeDot />
      {children}
    </p>
  );
}

export function Section({
  id,
  tone = "light",
  className,
  children,
}: {
  id?: string;
  tone?: "light" | "dark";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-tone={tone === "dark" ? "dark" : undefined}
      className={cx(
        "px-6 py-20 sm:py-28",
        tone === "dark" ? "bg-landing-ink text-landing-on-ink" : "bg-landing-bg text-landing-ink",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/** A polished mock product-UI card — used across sections to preview real Catalyst screens without wiring real data. */
export function MockCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-landing-border bg-landing-bg p-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PillTag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "lime";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "lime"
          ? "bg-landing-lime-soft text-landing-ink"
          : "bg-landing-surface text-landing-muted",
      )}
    >
      {children}
    </span>
  );
}
