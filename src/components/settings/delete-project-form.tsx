"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/actions/saas-project.actions";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={disabled || pending}>
      {pending ? "Deleting…" : "Delete project"}
    </Button>
  );
}

/** Requires typing the project's exact name before the delete button enables. */
export function DeleteProjectForm({
  projectId,
  projectName,
  action,
}: {
  projectId: string;
  projectName: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [confirmName, setConfirmName] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Field
        label={`Type "${projectName}" to confirm`}
        hint="This permanently deletes the project and all of its opportunities, conversations, engagements, experiments and reports. This cannot be undone."
      >
        <Input
          name="confirmName"
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          autoComplete="off"
          placeholder={projectName}
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton disabled={confirmName !== projectName} />
    </form>
  );
}
