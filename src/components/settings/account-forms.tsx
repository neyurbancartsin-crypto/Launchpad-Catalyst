"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AccountFormState } from "@/actions/account.actions";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Status({ state, okMessage }: { state: AccountFormState; okMessage: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-success">{okMessage}</p>;
  return null;
}

export function ProfileForm({
  name,
  email,
  action,
}: {
  name: string;
  email: string;
  action: (
    state: AccountFormState,
    formData: FormData,
  ) => Promise<AccountFormState>;
}) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      <Field label="Email" hint="Email changes are not supported yet.">
        <Input value={email} disabled readOnly />
      </Field>
      <Status state={state} okMessage="Profile updated." />
      <SubmitButton label="Save profile" />
    </form>
  );
}

export function PasswordForm({
  action,
}: {
  action: (
    state: AccountFormState,
    formData: FormData,
  ) => Promise<AccountFormState>;
}) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Current password">
        <Input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Status state={state} okMessage="Password changed." />
      <SubmitButton label="Change password" />
    </form>
  );
}
