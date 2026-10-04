"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Experiments/Tracking/Reports are deliberately not linked here for the
// current MVP — their routes, data and actions are untouched and still
// reachable directly, just not part of the primary nav (see the redesign
// brief: keep the core Dashboard -> Opportunities -> Strategy loop visible,
// hide the rest rather than removing it).
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/strategy", label: "Strategy" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
