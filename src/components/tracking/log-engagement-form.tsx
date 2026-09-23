"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EngagementFormState } from "@/actions/engagement.actions";
import { FUNNEL_STAGES, STAGE_LABELS } from "@/lib/funnel";
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Logging…" : "Log result"}
    </Button>
  );
}

export function LogEngagementForm({
  opportunities,
  action,
}: {
  opportunities: { id: string; title: string }[];
  action: (
    state: EngagementFormState,
    formData: FormData,
  ) => Promise<EngagementFormState>;
}) {
  const [state, formAction] = useActionState<EngagementFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform">
          <Select name="platform" defaultValue={SUPPORTED_PLATFORMS[0]}>
            {SUPPORTED_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABELS[platform]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Funnel stage">
          <Select name="stage" defaultValue="WEBSITE_VISIT">
            {FUNNEL_STAGES.filter((stage) => stage !== "OPPORTUNITY").map(
              (stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ),
            )}
          </Select>
        </Field>
      </div>

      <Field
        label="Conversation"
        hint="Optional. Link this result to the conversation that produced it."
      >
        <Select name="opportunityId" defaultValue="">
          <option value="">Not linked to a specific conversation</option>
          {opportunities.map((opportunity) => (
            <option key={opportunity.id} value={opportunity.id}>
              {opportunity.title.slice(0, 80)}
              {opportunity.title.length > 80 ? "…" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Count">
          <Input name="count" type="number" min={1} defaultValue={1} required />
        </Field>
        <Field label="Action" hint="Optional, e.g. Comment, Reply, DM.">
          <Input name="action" maxLength={120} />
        </Field>
      </div>

      <Field label="Notes" hint="Optional.">
        <Textarea name="notes" rows={2} maxLength={1000} />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-success">Logged.</p> : null}

      <SubmitButton />
    </form>
  );
}
