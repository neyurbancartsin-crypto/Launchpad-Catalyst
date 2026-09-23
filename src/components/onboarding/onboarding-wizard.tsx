"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/actions/saas-project.actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Finding your opportunities…" : "Find My Opportunities"}
    </Button>
  );
}

/**
 * Deliberately just one screen: a product name plus two required questions
 * and two optional ones, which is fast enough that splitting it into steps
 * would only add friction.
 */
export function OnboardingWizard({
  action,
  mode = "edit",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** "new" creates another project instead of updating the active one. */
  mode?: "new" | "edit";
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [notSure, setNotSure] = useState(false);

  return (
    <form action={formAction}>
      <input type="hidden" name="mode" value={mode} />

      <Card className="space-y-5">
        <Field label="Product name">
          <Input name="productName" required maxLength={120} placeholder="Workbass" />
        </Field>

        <Field
          label="What are you building?"
          hint="A couple of sentences is plenty."
        >
          <Textarea name="description" required minLength={20} />
        </Field>

        <Field label="What problem does it solve?">
          <Textarea name="problemSolved" required minLength={20} />
        </Field>

        <Field label="Who is it for?" hint="Optional — Catalyst can figure this out.">
          <Input
            name="targetCustomer"
            placeholder="Support leads at small SaaS companies"
            disabled={notSure}
          />
          <label className="mt-1.5 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={notSure}
              onChange={(event) => setNotSure(event.target.checked)}
            />
            I&apos;m not sure
          </label>
        </Field>

        <Field label="Website / product URL" hint="Optional.">
          <Input name="website" placeholder="acme.com" />
        </Field>

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-[#f0c4c1] bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-border pt-5">
          <SubmitButton />
        </div>
      </Card>
    </form>
  );
}
