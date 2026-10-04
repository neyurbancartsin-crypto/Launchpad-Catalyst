"use client";

import { useState } from "react";

/**
 * Presentation-only cleanup of raw platform content for display — never
 * written back to the database, never fed to scoring/AI. Several adapters'
 * raw text contains literal markup (HN/GitHub bodies carry `<p>`, `<a
 * href="...">`, `&#x2F;`-style entities) that otherwise renders as visible
 * tag soup in plain text output. Stripping it here is purely cosmetic and
 * changes nothing about what was discovered, scored, or stored.
 */
export function cleanConversationText(raw: string): string {
  return raw
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_match, href, label) =>
      label && label.trim() ? label : href,
    )
    .replace(/<\/(p|div|li|br)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EXCERPT_LENGTH = 220;

/** Cuts at a word boundary rather than mid-word, for a cleaner "…". */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

/**
 * "What the person is saying" — a short, readable excerpt by default, with
 * the full (still only cosmetically cleaned, never altered in meaning)
 * content available on demand. Keeps the card scannable without hiding
 * anything: the founder can always read the whole post.
 */
export function ConversationExcerpt({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = cleanConversationText(text);

  if (!cleaned) {
    return <p className="text-sm text-muted italic">No body text — see the title above.</p>;
  }

  const isLong = cleaned.length > EXCERPT_LENGTH;
  const shown = expanded || !isLong ? cleaned : truncate(cleaned, EXCERPT_LENGTH);

  return (
    <div>
      <p className="text-sm whitespace-pre-line text-foreground">{shown}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-medium text-brand hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
