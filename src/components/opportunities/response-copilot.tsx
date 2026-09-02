"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { PromotionRisk, ResponseStatus } from "@prisma/client";
import type { ResponseFormState } from "@/actions/responses.actions";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Select,
  Textarea,
} from "@/components/ui";

const STYLES = [
  { value: "helpful", label: "Helpful" },
  { value: "conversational", label: "Conversational" },
  { value: "short", label: "Short" },
  { value: "detailed", label: "Detailed" },
  { value: "technical", label: "Technical" },
  { value: "experience-based", label: "Experience-based" },
];

export interface ResponseRecord {
  id: string;
  style: string;
  draft: string;
  finalText: string | null;
  mentionsProduct: boolean;
  guidanceNote: string | null;
  status: ResponseStatus;
  postedAt: Date | null;
  createdAt: Date;
}

function PendingButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ResponseCopilot({
  opportunityId,
  promotionRisk,
  recommendedAction,
  comments,
  responses,
  generateAction,
  saveAction,
  markPostedAction,
}: {
  opportunityId: string;
  promotionRisk: PromotionRisk;
  recommendedAction: string;
  comments: { id: string; author: string; body: string }[];
  responses: ResponseRecord[];
  generateAction: (
    state: ResponseFormState,
    formData: FormData,
  ) => Promise<ResponseFormState>;
  saveAction: (
    state: ResponseFormState,
    formData: FormData,
  ) => Promise<ResponseFormState>;
  markPostedAction: (formData: FormData) => Promise<void>;
}) {
  const [genState, genAction] = useActionState<ResponseFormState, FormData>(
    generateAction,
    {},
  );

  // A product mention is only ever offered when the analysis actually supports
  // it — the UI does not let the founder override a high-risk assessment.
  const mentionAllowed =
    promotionRisk !== "HIGH" && recommendedAction === "Mention your product";

  return (
    <Card>
      <CardHeader
        title="Response copilot"
        description="Generates a value-first draft. You review it, edit it, and post it yourself."
      />

      <form action={genAction} className="space-y-4">
        <input type="hidden" name="opportunityId" value={opportunityId} />

        <Field label="Style">
          <Select name="style" defaultValue="helpful">
            {STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </Select>
        </Field>

        {comments.length > 0 ? (
          <Field
            label="Replying to"
            hint="Pick a specific comment, or leave blank to reply to the post itself."
          >
            <Select name="targetComment" defaultValue="">
              <option value="">The original post</option>
              {comments.map((comment) => (
                <option key={comment.id} value={comment.body}>
                  {comment.author}: {comment.body.slice(0, 70)}
                  {comment.body.length > 70 ? "…" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="allowProductMention"
            disabled={!mentionAllowed}
            className="mt-0.5"
          />
          <span className={mentionAllowed ? "text-foreground" : "text-muted"}>
            Include a product mention
            <span className="mt-0.5 block text-xs text-muted">
              {mentionAllowed
                ? "The analysis supports a mention here. It will be disclosed as yours."
                : promotionRisk === "HIGH"
                  ? "Unavailable: promotion risk is high in this community."
                  : `Unavailable: the recommended action is "${recommendedAction}", not a product mention.`}
            </span>
          </span>
        </label>

        {genState.error ? (
          <p role="alert" className="text-sm text-danger">
            {genState.error}
          </p>
        ) : null}

        <PendingButton label="Generate draft" pendingLabel="Writing…" />
      </form>

      {responses.length > 0 ? (
        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Drafts ({responses.length})
          </h3>
          {responses.map((response) => (
            <DraftCard
              key={response.id}
              response={response}
              saveAction={saveAction}
              markPostedAction={markPostedAction}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function DraftCard({
  response,
  saveAction,
  markPostedAction,
}: {
  response: ResponseRecord;
  saveAction: (
    state: ResponseFormState,
    formData: FormData,
  ) => Promise<ResponseFormState>;
  markPostedAction: (formData: FormData) => Promise<void>;
}) {
  const [saveState, save] = useActionState<ResponseFormState, FormData>(
    saveAction,
    {},
  );
  const posted = response.status === "POSTED";

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={posted ? "success" : "brand"}>
          {posted ? "Posted" : response.status === "EDITED" ? "Edited" : "Draft"}
        </Badge>
        <Badge>{response.style}</Badge>
        {response.mentionsProduct ? (
          <Badge tone="warning">Mentions product</Badge>
        ) : (
          <Badge>No product mention</Badge>
        )}
        {response.postedAt ? (
          <span className="text-xs text-muted">
            Posted {response.postedAt.toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {response.guidanceNote ? (
        <p className="mb-3 rounded-lg border border-demo-border bg-demo-soft px-3 py-2 text-xs text-demo">
          {response.guidanceNote}
        </p>
      ) : null}

      <form action={save} className="space-y-3">
        <input type="hidden" name="responseId" value={response.id} />
        <Textarea
          name="finalText"
          defaultValue={response.finalText ?? response.draft}
          rows={8}
          readOnly={posted}
        />

        {saveState.error ? (
          <p role="alert" className="text-sm text-danger">
            {saveState.error}
          </p>
        ) : null}
        {saveState.ok ? <p className="text-sm text-success">Saved.</p> : null}

        {!posted ? (
          <div className="flex flex-wrap gap-2">
            <PendingButton
              label="Save edits"
              pendingLabel="Saving…"
              variant="secondary"
            />
          </div>
        ) : null}
      </form>

      {!posted ? (
        <form action={markPostedAction} className="mt-3 border-t border-border pt-3">
          <input type="hidden" name="responseId" value={response.id} />
          <div className="flex flex-wrap items-center gap-3">
            <PendingButton label="I posted this" pendingLabel="Recording…" />
            <p className="text-xs text-muted">
              Post it on the platform yourself first — Launchpad Catalyst never
              posts for you.
            </p>
          </div>
        </form>
      ) : null}
    </article>
  );
}
