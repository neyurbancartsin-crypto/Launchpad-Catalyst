# Launchpad Catalyst

Find the right conversations. Take the right actions. Get your first users.

An acquisition system for early-stage SaaS founders: identify your ideal
customers, discover the conversations worth joining across Reddit, X and
LinkedIn, understand which opportunities are real, draft a value-first
response, track what it produced, and learn what is actually working.

## Current status: demo mode (live integrations written, not switched on)

No platform APIs and no AI provider key are configured yet, so the product runs
end-to-end on **bundled demo fixtures**, labelled as such everywhere they
appear. It never claims a live connection it does not have.

The live integrations **are written and compile** — they are waiting on
credentials, not on code:

| Integration | Status | Switch on with |
| --- | --- | --- |
| Claude API (`ClaudeAIProvider`) | Written, untested against a real key | `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` |
| Reddit official API (`RedditAdapter`) | Written, untested against real credentials | `REDDIT_ADAPTER=live` + `REDDIT_CLIENT_ID`/`SECRET` |
| X, LinkedIn | Not implemented — APIs need paid or partner-approved access | — |
| Email (password reset, verification) | Written; logs to server console | `MAIL_PROVIDER` (only `console` implemented) |

Requesting an integration that isn't implemented **fails loudly** rather than
silently falling back to demo data.

- **Platform data** comes from mock adapters behind the `PlatformAdapter`
  interface (`src/lib/adapters/`). Settings shows an honest `Demo data` status
  per platform, read directly from each adapter.
- **AI analysis** comes from `MockAIProvider` behind the `AIProvider` interface
  (`src/lib/ai/`), which derives its output from your intake rather than a
  language model.
- **Opportunity scores are not mocked.** They are computed by deterministic,
  unit-tested rules in `src/lib/scoring/`, so those numbers do not change when
  a real AI provider is connected.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in `AUTH_SECRET` (generate one with
`npx auth secret`) and both database URLs.

### Database

The datasource needs **two** Supabase connection strings, from
*Project Settings → Database → Connection string → ORMs (Prisma)*:

| Variable | Port | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `6543` | The app. Pooled; keep `?pgbouncer=true` |
| `DIRECT_URL` | `5432` | Migrations. DDL and advisory locks need a real session |

If the password contains `@ # $ % / : ? &` it must be URL-encoded, or the
connection string will not parse. `scripts/set-db-password.mjs` prompts for the
password with echo off and handles the encoding:

```bash
node scripts/set-db-password.mjs
```

Then apply the schema and seed a demo account:

```bash
npx prisma migrate deploy   # forward-only; use `npm run db:migrate` in local dev
npm run db:seed
```

The seed creates a founder mid-loop (onboarded, opportunities discovered, one
response posted, funnel results logged, an experiment ready to analyse):

- Email: `demo@launchpadcatalyst.test`
- Password: `demo-password-123`

```bash
npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm test` | Scoring unit tests |
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:seed` | Seed the demo account |
| `npm run db:studio` | Browse the database |

## Architecture

```
src/
  actions/          Server actions, one file per domain
  app/(auth)/       Login and signup
  app/(dashboard)/  Dashboard, Opportunities, Strategy, Experiments,
                    Tracking, Reports, Settings
  lib/
    adapters/       PlatformAdapter interface + Reddit/X/LinkedIn mocks
    ai/             AIProvider interface + MockAIProvider
    scoring/        Deterministic opportunity scoring (unit tested)
    discovery.ts    communities -> posts -> comments -> analysis -> scoring
    funnel.ts       Acquisition funnel aggregation
```

Only `lib/adapters/` and `lib/ai/` know that anything is mocked. Pages, server
actions and the scoring engine talk to the interfaces via the registries.

### Opportunity scoring

Weighted per the PRD: ICP match 25%, problem match 25%, intent 20%, recency
10%, relevance 10%, engagement 10%. Priority bands are 80–100 high, 60–79 worth
reviewing, 40–59 low, below 40 do not prioritise.

Phrase matching is exact for short keywords and partial (word overlap) for
sentence-length pain points, because real posts describe a problem in their own
words rather than quoting yours.

### Promotion risk

Risk rises when a product mention would be unwelcome: a strict community, weak
intent, weak relevance, an off-target problem, and above all when nobody asked
for a solution. The Response Copilot only offers a product mention when the
analysis supports one — a high-risk assessment cannot be overridden in the UI.

## Connecting real services

**Claude** — set `AI_PROVIDER=claude` and `ANTHROPIC_API_KEY`. Note that
`ClaudeAIProvider` deliberately does *not* let the model produce scores: it
calls the same `lib/scoring` functions as demo mode and asks Claude only for
the language around them. The bottleneck verdict is likewise rule-based. So
connecting a key changes the prose, never the numbers.

It does change one thing materially: the landing page analyser switches from
illustrative to a real audit, because `ClaudeAIProvider` fetches the page with
the server-side `web_fetch` tool.

**Reddit** — create a *script* app at https://www.reddit.com/prefs/apps, then
set `REDDIT_ADAPTER=live`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` and
`REDDIT_USER_AGENT`. The adapter is read-only (search, posts, comments) and
uses OAuth client credentials; it never posts, votes or messages.

**X / LinkedIn** — no live adapter exists. Implement `PlatformAdapter`
(`src/lib/adapters/types.ts`), return `isDemoData: false` and a `CONNECTED`
status, and add the case in `src/lib/adapters/registry.ts`. The DTOs already
mirror real API field shapes, and the persisted `isDemoData` flag makes the
demo badges disappear on their own.

## Security notes

- Passwords are bcrypt-hashed (cost 12). Login compares against a dummy hash
  when the account is missing so timing does not reveal which emails exist.
- Password-reset and email-verification tokens are random 32-byte values;
  only their SHA-256 hash is stored, they expire, and they are single-use
  (burned via a conditional update so concurrent redemptions cannot both win).
- Requesting a reset always reports the same message, so the endpoint cannot
  be used to enumerate registered emails. Resetting a password drops sessions.
- Login, signup, password reset, AI drafting and discovery are rate limited
  (`src/lib/rate-limit.ts`). The store is in-memory, so it protects a single
  instance — back it with Redis before running multiple instances.
- Every query is scoped to the signed-in user's project; ids arriving from
  forms are re-checked against ownership rather than trusted.

## Still open

- **Deployment** — the app has only ever run locally. Nothing is deployed.
  `AUTH_SECRET` is still a development placeholder and must be regenerated
  before it goes anywhere real.
- **Live-integration testing** — the Claude and Reddit code paths compile and
  are wired, but have never run against real credentials.
- **Billing, teams/multi-seat** — not built; out of MVP scope.
- **Distributed rate limiting and error monitoring** — see Security notes.

## Deliberately not included

Instagram, Facebook, Discord, Telegram and YouTube; a full CRM, email marketing
platform, SEO suite or social scheduler; mass posting, mass commenting, spam
automation, fake engagement, and autonomous account activity.

The Response Copilot only ever drafts. The founder posts on the platform
themselves and then records it — the product never posts on anyone's behalf.

Platform APIs do not report signups back to you, so attribution is recorded
manually on the Tracking page. Use tracked links or UTM parameters on anything
you share.
