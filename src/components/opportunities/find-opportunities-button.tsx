"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function FindOpportunitiesButton({
  variant = "primary",
}: {
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Finding new opportunities…" : "Find New Opportunities"}
    </Button>
  );
}
