/**
 * Transactional email.
 *
 * No provider is configured yet, so messages are written to the server log and
 * the flow is honest about it: nothing pretends an email was delivered.
 *
 * To send real email later, implement `send` against a provider (e.g. Resend)
 * and select it with MAIL_PROVIDER — no call site changes.
 */

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  readonly id: string;
  /** True when messages are logged rather than delivered. */
  readonly isConsoleOnly: boolean;
  send(email: Email): Promise<void>;
}

class ConsoleMailer implements Mailer {
  readonly id = "console";
  readonly isConsoleOnly = true;

  async send(email: Email): Promise<void> {
    console.info(
      [
        "",
        "──────────────── EMAIL (not sent — no mail provider configured) ────────────────",
        `To:      ${email.to}`,
        `Subject: ${email.subject}`,
        "",
        email.body,
        "────────────────────────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  const configured = (process.env.MAIL_PROVIDER ?? "console").toLowerCase();
  switch (configured) {
    case "console":
      cached = new ConsoleMailer();
      break;
    default:
      throw new Error(
        `Unknown MAIL_PROVIDER "${configured}". Supported values: console.`,
      );
  }
  return cached;
}
