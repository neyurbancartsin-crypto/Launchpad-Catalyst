"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AuthFormState } from "@/actions/auth.actions";
import { Button, Card, Field, Input } from "@/components/ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </Button>
  );
}

function Messages({ state }: { state: AuthFormState }) {
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-[#f0c4c1] bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-lg border border-[#bde3d1] bg-success-soft px-3 py-2 text-sm text-success">
          {state.notice}
        </p>
      ) : null}
    </>
  );
}

export function ForgotPasswordForm({
  action,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});

  return (
    <Card>
      <h1 className="text-base font-semibold text-foreground">Reset your password</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Enter your email and we will send you a link to set a new one.
      </p>

      <form action={formAction} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Messages state={state} />
        <SubmitButton label="Send reset link" />
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm({
  token,
  action,
}: {
  token: string;
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});
  const done = Boolean(state.notice);

  return (
    <Card>
      <h1 className="text-base font-semibold text-foreground">Choose a new password</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        This link can only be used once.
      </p>

      {!done ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label="New password" hint="At least 8 characters.">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
          <Messages state={state} />
          <SubmitButton label="Set new password" />
        </form>
      ) : (
        <Messages state={state} />
      )}

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Go to sign in
        </Link>
      </p>
    </Card>
  );
}
