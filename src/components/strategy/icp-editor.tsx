"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/actions/saas-project.actions";
import { Button, Card, CardHeader, Field, Input, Textarea } from "@/components/ui";

export interface IcpEditorValues {
  primaryCustomer: string;
  secondaryCustomer: string;
  companySize: string;
  roles: string[];
  industries: string[];
  painPoints: string[];
  buyingTriggers: string[];
  objections: string[];
  searchTopics: string[];
  intentSignals: string[];
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function ListField({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: string[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint ?? "One per line."}>
      <Textarea name={name} defaultValue={value.join("\n")} rows={value.length + 1} />
    </Field>
  );
}

export function IcpEditor({
  values,
  editedByUser,
  action,
}: {
  values: IcpEditorValues;
  editedByUser: boolean;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Card>
        <CardHeader
          title="Ideal customer profile"
          description={
            editedByUser
              ? "Edited by you. Discovery uses these values."
              : "Generated from your intake. Edit anything that does not match reality."
          }
          action={
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          }
        />
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-foreground">Primary customer</dt>
            <dd className="mt-0.5 text-muted">{values.primaryCustomer}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Secondary customer</dt>
            <dd className="mt-0.5 text-muted">{values.secondaryCustomer}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Company size</dt>
            <dd className="mt-0.5 text-muted">{values.companySize}</dd>
          </div>
          <ReadOnlyList label="Roles" items={values.roles} />
          <ReadOnlyList label="Industries" items={values.industries} />
          <ReadOnlyList label="Pain points" items={values.painPoints} />
          <ReadOnlyList label="Buying triggers" items={values.buyingTriggers} />
          <ReadOnlyList label="Likely objections" items={values.objections} />
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Edit ideal customer profile"
        description="Changes here change what gets discovered and how it is scored."
      />
      <form action={formAction} className="space-y-4">
        <Field label="Primary customer">
          <Textarea name="primaryCustomer" defaultValue={values.primaryCustomer} required />
        </Field>
        <Field label="Secondary customer">
          <Textarea name="secondaryCustomer" defaultValue={values.secondaryCustomer} required />
        </Field>
        <Field label="Company size">
          <Input name="companySize" defaultValue={values.companySize} required />
        </Field>
        <ListField label="Roles" name="roles" value={values.roles} />
        <ListField label="Industries" name="industries" value={values.industries} />
        <ListField label="Pain points" name="painPoints" value={values.painPoints} />
        <ListField label="Buying triggers" name="buyingTriggers" value={values.buyingTriggers} />
        <ListField label="Likely objections" name="objections" value={values.objections} />
        <ListField
          label="Search topics"
          name="searchTopics"
          value={values.searchTopics}
          hint="One per line. These drive which conversations get found."
        />
        <ListField
          label="Intent signals"
          name="intentSignals"
          value={values.intentSignals}
          hint="One per line. Phrases that suggest someone is looking for a solution."
        />

        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="text-sm text-success">
            Saved. Refresh opportunities to re-score with the new profile.
          </p>
        ) : null}

        <div className="flex gap-3 border-t border-border pt-4">
          <SaveButton />
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Done
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReadOnlyList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-1">
        <ul className="list-disc space-y-1 pl-5 text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
