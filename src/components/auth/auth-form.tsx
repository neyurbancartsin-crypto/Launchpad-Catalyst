"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const isSignup = mode === "signup";

  return (
    <Card>
      <h1 className="text-base font-semibold text-foreground">
        {isSignup ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        {isSignup
          ? "Set up your workspace and get your first acquisition plan."
          : "Welcome back."}
      </p>

      <form action={formAction} className="space-y-4">
        {!isSignup ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}

        {isSignup ? (
          <Field label="Name">
            <Input name="name" autoComplete="name" required maxLength={80} />
          </Field>
        ) : null}

        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>

        <Field
          label="Password"
          hint={isSignup ? "At least 8 characters." : undefined}
        >
          <Input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </Field>

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-[#f0c4c1] bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <SubmitButton label={isSignup ? "Create account" : "Sign in"} />
      </form>

      {!isSignup ? (
        <p className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-muted hover:text-brand hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
      ) : null}

      <p className="mt-5 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "No account yet? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-brand hover:underline"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </Card>
  );
}
