"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ExperimentFormState } from "@/actions/experiments.actions";
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function CreateExperimentForm({
  action,
}: {
  action: (
    state: ExperimentFormState,
    formData: FormData,
  ) => Promise<ExperimentFormState>;
}) {
  const [state, formAction] = useActionState<ExperimentFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input
          name="name"
          required
          maxLength={120}
          placeholder="Reddit support-problem conversations"
        />
      </Field>

      <Field
        label="Hypothesis"
        hint="What do you believe, and what would prove it?"
      >
        <Textarea
          name="hypothesis"
          required
          minLength={10}
          placeholder="Support leads discussing repetitive ticket volume on Reddit may become potential users."
        />
      </Field>

      <Field label="Channel" hint="Optional — leave blank for a cross-channel test.">
        <Select name="channel" defaultValue="">
          <option value="">All channels</option>
          {SUPPORTED_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABELS[platform]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Action you will take">
        <Textarea
          name="action"
          required
          minLength={5}
          placeholder="Provide useful answers without immediately pitching."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date">
          <Input name="startDate" type="date" required defaultValue={isoDate(0)} />
        </Field>
        <Field label="End date">
          <Input name="endDate" type="date" required defaultValue={isoDate(7)} />
        </Field>
        <Field label="Target conversations">
          <Input
            name="targetConversations"
            type="number"
            min={0}
            defaultValue={20}
            required
          />
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label="Create experiment" pendingLabel="Creating…" />
    </form>
  );
}

export function ExperimentResultForm({
  experimentId,
  initial,
  action,
}: {
  experimentId: string;
  initial: {
    conversations: number;
    websiteVisits: number;
    signups: number;
    activatedUsers: number;
    paidUsers: number;
  } | null;
  action: (
    state: ExperimentFormState,
    formData: FormData,
  ) => Promise<ExperimentFormState>;
}) {
  const [state, formAction] = useActionState<ExperimentFormState, FormData>(
    action,
    {},
  );

  const fields = [
    { name: "conversations", label: "Conversations" },
    { name: "websiteVisits", label: "Website visits" },
    { name: "signups", label: "Signups" },
    { name: "activatedUsers", label: "Activated users" },
    { name: "paidUsers", label: "Paid users" },
  ] as const;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="experimentId" value={experimentId} />
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <Field key={field.name} label={field.label}>
            <Input
              name={field.name}
              type="number"
              min={0}
              required
              defaultValue={initial?.[field.name] ?? 0}
            />
          </Field>
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-success">Results saved.</p> : null}

      <SubmitButton label="Save results" pendingLabel="Saving…" />
    </form>
  );
}
