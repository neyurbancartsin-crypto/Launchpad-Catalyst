"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/actions/saas-project.actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useDiscoveryStageIndex } from "@/components/opportunities/discovery-stage-tracker";
import { DiscoveryFullScreen } from "@/components/opportunities/discovery-fullscreen";

/**
 * Onboarding's own "Find My Opportunities" trigger — a different server
 * action (`completeOnboardingAction`) from the Opportunities page's "Find
 * New Opportunities" (`refreshOpportunitiesAction`), but both end in the
 * same discovery pipeline, so both get the same full-screen tracker. This
 * one never reaches "completed" on its own: `completeOnboardingAction`
 * redirects to /strategy on success rather than returning a result, so the
 * real completion signal here is simply the page navigating away. The
 * tracker holds at "Analysing relevance" for as long as the real request
 * takes and is replaced by the next page the moment it actually finishes —
 * it never shows "Best opportunities found" before that.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  const stepIndex = useDiscoveryStageIndex(pending, false);

  return (
    <>
      <Button type="submit" disabled={pending}>
        Find My Opportunities
      </Button>
      {pending ? <DiscoveryFullScreen stepIndex={stepIndex} /> : null}
    </>
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

        <Field
          label="What are the main use cases of your product?"
          hint="Optional. Tell us when or why someone would use your product."
        >
          <Textarea
            name="useCases"
            placeholder="Testing a new TV for dead pixels&#10;Checking a second-hand monitor before buying&#10;Diagnosing a suspected display defect"
          />
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
            className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
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
