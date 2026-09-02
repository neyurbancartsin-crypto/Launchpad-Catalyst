"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/actions/saas-project.actions";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const STEPS = [
  { id: 0, label: "Your product" },
  { id: 1, label: "Your market" },
  { id: 2, label: "Your situation" },
  { id: 3, label: "Optional" },
] as const;

/** Fields that must be valid before the founder can leave each step. */
const REQUIRED_BY_STEP: Record<number, string[]> = {
  0: ["name", "website", "description", "problemSolved"],
  1: ["targetCustomer", "category", "pricing", "businessModel", "targetGeography", "competitors"],
  2: ["currentUsers", "payingUsers", "currentChannels", "biggestProblem"],
  3: [],
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Analysing your SaaS…" : "Analyse my SaaS"}
    </Button>
  );
}

export function OnboardingWizard({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  function goNext(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;

    // Validate only this step's fields; later steps are still empty.
    for (const fieldName of REQUIRED_BY_STEP[step] ?? []) {
      const field = form.elements.namedItem(fieldName);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        if (!field.checkValidity()) {
          field.reportValidity();
          setStepError("Fill in the highlighted field to continue");
          return;
        }
      }
    }
    setStepError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <form action={formAction}>
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <li key={s.id}>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                s.id === step
                  ? "border-[#c4d3f7] bg-brand-soft text-brand"
                  : s.id < step
                    ? "border-[#bde3d1] bg-success-soft text-success"
                    : "border-border bg-surface-muted text-muted"
              }`}
            >
              {s.id < step ? "✓" : s.id + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        {/* All steps stay mounted so values survive navigation and submit together. */}
        <div hidden={step !== 0} className="space-y-4">
          <Field label="Product name">
            <Input name="name" required maxLength={120} placeholder="Acme Support" />
          </Field>
          <Field label="Website">
            <Input name="website" type="url" required placeholder="https://acme.com" />
          </Field>
          <Field label="What does your product do?" hint="Two or three sentences is plenty.">
            <Textarea name="description" required minLength={20} />
          </Field>
          <Field label="What problem does it solve?">
            <Textarea name="problemSolved" required minLength={20} />
          </Field>
        </div>

        <div hidden={step !== 1} className="space-y-4">
          <Field label="Who is your target customer?">
            <Input name="targetCustomer" required placeholder="Support leads at small SaaS companies" />
          </Field>
          <Field label="Product category">
            <Input name="category" required placeholder="Customer support automation" />
          </Field>
          <Field label="Pricing">
            <Input name="pricing" required placeholder="$49/month per seat" />
          </Field>
          <Field label="Business model">
            <Select name="businessModel" required defaultValue="B2B">
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
              <option value="B2B2C">B2B2C</option>
            </Select>
          </Field>
          <Field label="Target geography">
            <Input name="targetGeography" required placeholder="US and Europe" />
          </Field>
          <Field label="Main competitors" hint="Comma separated. Write 'none' if you are not sure.">
            <Input name="competitors" required placeholder="Zendesk, Intercom" />
          </Field>
        </div>

        <div hidden={step !== 2} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current users">
              <Input name="currentUsers" type="number" min={0} required defaultValue={0} />
            </Field>
            <Field label="Current paying users">
              <Input name="payingUsers" type="number" min={0} required defaultValue={0} />
            </Field>
          </div>
          <Field label="Current marketing channels" hint="Write 'none' if you have not started.">
            <Input name="currentChannels" required placeholder="Occasional Twitter posts" />
          </Field>
          <Field label="Biggest acquisition problem">
            <Textarea
              name="biggestProblem"
              required
              minLength={10}
              placeholder="I do not know where my customers spend time or what to say to them."
            />
          </Field>
        </div>

        <div hidden={step !== 3} className="space-y-4">
          <p className="text-sm text-muted">
            All optional — these sharpen the recommendations but you can skip them.
          </p>
          <Field label="Marketing budget">
            <Input name="marketingBudget" placeholder="$0–200/month" />
          </Field>
          <Field label="Hours available per week">
            <Input name="hoursPerWeek" type="number" min={0} max={168} placeholder="8" />
          </Field>
          <Field label="Existing audience">
            <Input name="existingAudience" placeholder="400 Twitter followers, small newsletter" />
          </Field>
          <Field label="Social profiles">
            <Input name="socialProfiles" placeholder="x.com/yourhandle" />
          </Field>
        </div>

        {stepError ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {stepError}
          </p>
        ) : null}
        {state.error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[#f0c4c1] bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((c) => Math.max(0, c - 1))}
            disabled={step === 0}
          >
            Back
          </Button>

          {isLastStep ? (
            <SubmitButton />
          ) : (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          )}
        </div>
      </Card>
    </form>
  );
}
