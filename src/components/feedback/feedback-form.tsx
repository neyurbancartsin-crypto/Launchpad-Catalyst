"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitFeedbackAction, type FeedbackFormState } from "@/actions/feedback.actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

const FEEDBACK_TYPE_OPTIONS = [
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "FEATURE_REQUEST", label: "Feature Request" },
  { value: "BUG_REPORT", label: "Bug Report" },
  { value: "OTHER", label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send feedback"}
    </Button>
  );
}

/**
 * The form body is remounted (via the trigger's `key`) every time it opens,
 * so a previous success/error state never leaks into the next time someone
 * opens it. On a failed submission the fields are left exactly as the user
 * typed them — this is an uncontrolled form (`defaultValue`), so React never
 * resets their input just because the server action re-rendered the error.
 */
export function FeedbackForm({
  defaultName,
  defaultEmail,
  onDone,
}: {
  defaultName: string;
  defaultEmail: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FeedbackFormState, FormData>(submitFeedbackAction, {});

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm font-medium text-foreground">
          Thanks for your feedback! Your ideas help us make Catalyst better.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name">
        <Input name="name" required maxLength={120} defaultValue={defaultName} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required maxLength={254} defaultValue={defaultEmail} />
      </Field>
      <Field label="Feedback type">
        <Select name="type" required defaultValue="SUGGESTION">
          {FEEDBACK_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Feedback" hint="What's working, what isn't, what you'd like to see.">
        <Textarea name="message" required minLength={5} maxLength={4000} className="min-h-32" />
      </Field>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="consent" className="mt-0.5" />
        I&apos;m happy to receive occasional product updates and launch announcements by email.
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
