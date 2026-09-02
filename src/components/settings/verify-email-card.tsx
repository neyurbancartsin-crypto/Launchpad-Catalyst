"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "@/actions/auth.actions";
import { Badge, Button, Card, CardHeader } from "@/components/ui";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Sending…" : "Resend confirmation"}
    </Button>
  );
}

export function VerifyEmailCard({
  verified,
  consoleOnly,
  action,
}: {
  verified: boolean;
  consoleOnly: boolean;
  action: () => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    async () => action(),
    {},
  );

  return (
    <Card>
      <CardHeader
        title="Email address"
        action={
          <Badge tone={verified ? "success" : "warning"}>
            {verified ? "Confirmed" : "Unconfirmed"}
          </Badge>
        }
      />
      <p className="text-sm text-muted">
        {verified
          ? "Your email address is confirmed."
          : "Confirm your email so password resets can reach you."}
      </p>

      {consoleOnly ? (
        <p className="mt-3 rounded-lg border border-demo-border bg-demo-soft px-3 py-2 text-xs text-demo">
          No mail provider is configured, so confirmation and reset emails are
          written to the server log instead of being delivered.
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="mt-3 text-sm text-success">{state.notice}</p>
      ) : null}

      {!verified ? (
        <form action={formAction} className="mt-4">
          <SendButton />
        </form>
      ) : null}
    </Card>
  );
}
