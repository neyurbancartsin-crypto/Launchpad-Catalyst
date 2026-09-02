"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReportFormState } from "@/actions/reports.actions";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Analysing…" : "Analyse page"}
    </Button>
  );
}

export function LandingPageAuditForm({
  defaultUrl,
  action,
}: {
  defaultUrl: string;
  action: (
    state: ReportFormState,
    formData: FormData,
  ) => Promise<ReportFormState>;
}) {
  const [state, formAction] = useActionState<ReportFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Page URL">
        <Input name="url" type="url" required defaultValue={defaultUrl} />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
