"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AnalyzeConversationFormState } from "@/actions/opportunities.actions";
import { Button } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Analyzing…" : "Analyze conversation"}
    </Button>
  );
}

/**
 * Discovery only retrieves and stores comments (no AI, PRD-aligned cost
 * control) — this button is the one place a founder actually spends an AI
 * call to see which comments are worth responding to.
 */
export function AnalyzeConversationButton({
  opportunityId,
  action,
}: {
  opportunityId: string;
  action: (
    state: AnalyzeConversationFormState,
    formData: FormData,
  ) => Promise<AnalyzeConversationFormState>;
}) {
  const [state, formAction] = useActionState<AnalyzeConversationFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
