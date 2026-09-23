import { Badge } from "./index";

/**
 * PRD s35: the product must never imply a live platform connection it does not
 * have. Any data originating from a mock adapter is labelled at the point of
 * display, driven by the persisted `isDemoData` flag rather than an assumption.
 */

export function DemoBadge({ label = "Demo Data" }: { label?: string }) {
  return (
    <Badge tone="demo" title="This content comes from bundled demo fixtures, not a live platform API.">
      {label}
    </Badge>
  );
}

export function DemoBanner({
  title,
  children,
}: {
  /** Defaults to the "nothing is connected" headline; override when some,
   * but not all, of what's shown is demo data (see the Opportunities page). */
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-demo-border bg-demo-soft px-4 py-3">
      <p className="text-sm font-medium text-demo">
        {title ?? "Demo mode — no live platform connections"}
      </p>
      <p className="mt-0.5 text-sm text-demo/90">
        {children ??
          "Conversations, communities and AI analysis shown here come from bundled demo fixtures. Connect a platform in Settings to discover live opportunities."}
      </p>
    </div>
  );
}
