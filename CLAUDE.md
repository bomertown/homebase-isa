# CLAUDE.md — Homebase Project Master Handoff

This document is the source of truth for the Homebase project. Read it fully before any work. When in doubt, this document overrides assumptions.

## Your role: Senior Engineer

You are working on Homebase. The product owner is Juan Fernandez Ritacco (16, solo founder, Miami). The CTO is a virtual senior engineer who reviews your work before each unit ships. You report to the CTO. The CTO reports to Juan.

Your job is to write production-quality code that follows the architecture, principles, and constraints in this document. You do not make product decisions — those come from Juan via the CTO. You do not make architectural decisions that contradict this document — those are locked.

When you're unsure about a product decision, write a question in `QUESTIONS.md` at the repo root, do not guess. The CTO will batch-answer questions every review cycle.

When you're unsure about a technical decision that this document doesn't cover, propose your recommendation in your handoff message and proceed with it provisionally. The CTO will confirm or redirect.

## Product: what Homebase is

Homebase is a **bilingual AI Inside Sales Agent (ISA)** for solo real estate agents. It is not a CRM. The distinction matters and shapes every decision.

### What it does

1. Receives leads from multiple channels (Tally form, email forwarded by agent, SMS to Twilio number, missed calls)
2. Detects the lead's language automatically (English or Spanish)
3. Responds to the lead within 60 seconds with AI-generated personalized email in the lead's language
4. Runs a Day 1 / Day 3 / Day 7 follow-up sequence with AI-written emails
5. Detects when a lead replies (any channel) and stops the sequence automatically
6. Classifies reply intent (interest_high, objection, request_info, scheduling, opt_out, other)
7. Generates a draft response for the agent to send with one click
8. Sends the agent a daily AI briefing at 8am with prioritized action items
9. Handles missed calls with a recorded voicemail + automatic SMS text-back
10. Provides a clean web dashboard for the agent to see leads and conversations

### What it explicitly is NOT

- A CRM (no pipeline kanban, no tags, no custom fields, no transaction management)
- A team product (single-agent only in V1)
- A self-serve product (manual onboarding only in V1)
- A bilingual UI product (the UI is English; the LEADS get bilingual messaging)
- A native mobile app (responsive web only)
- Voice AI capable (text channels only)
- Connected to MLS, Zillow, Realtor.com, Facebook Lead Ads, WhatsApp, Instagram (those are V2+)

### Positioning

The pitch is: "$99/month instead of $50K/year for an ISA who never sleeps and works in two languages." This compares Homebase to a human Inside Sales Agent, not to other CRMs. This is intentional and shapes feature decisions.

## Architecture (locked)

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (everything here)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (Next.js 14 App Router + TypeScript)          │
│  ├─ Marketing landing                                   │
│  ├─ Auth (Clerk)                                        │
│  └─ Agent dashboard (4 pages)                           │
│                                                         │
│  API Layer (Next.js Route Handlers + Fluid Compute)     │
│  ├─ /api/webhooks/tally                                 │
│  ├─ /api/webhooks/twilio/sms                            │
│  ├─ /api/webhooks/twilio/voice                          │
│  ├─ /api/webhooks/email                                 │
│  ├─ /api/agents/*                                       │
│  └─ /api/leads/*                                        │
│                                                         │
│  Workflow Layer (Vercel Workflows + AI SDK v7)          │
│  ├─ leadIntakeWorkflow                                  │
│  ├─ followUpSequenceWorkflow                            │
│  ├─ replyHandlerWorkflow                                │
│  └─ dailyBriefingWorkflow (cron)                        │
│                                                         │
│  Database (Vercel Postgres / Neon + Drizzle ORM)        │
│                                                         │
│  External Services                                      │
│  ├─ OpenAI via Vercel AI Gateway                        │
│  ├─ Twilio (SMS, voice, missed-call handling)           │
│  ├─ Resend (email send + inbound parse)                 │
│  ├─ Cloudflare R2 (voicemail audio storage)             │
│  └─ Sentry (error monitoring)                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key architectural principles

1. **Everything on Vercel.** No external orchestrators (no n8n), no separate workers. Vercel Functions + Workflows + Postgres handle everything.

2. **Workflows for durable work.** Anything that pauses (follow-up sequences), fails (AI calls), or coordinates multiple steps goes in a Vercel Workflow. Use `'use workflow'` and `step()` properly.

3. **Database is source of truth.** All state lives in Postgres. Workflows read/write the DB. The web app reads/writes the DB. No other source of truth exists.

4. **Bilingual at the lead level, not the UI level.** The agent dashboard is in English. Each lead has a `detectedLanguage` field. All AI-generated content for the lead (emails, SMS) uses that language. The agent's daily briefing uses the agent's `preferredLanguage`.

5. **AI as orchestration glue, not just text generation.** The product positioning is "AI agent" — use AI for classification, scoring, prioritization, draft generation, language detection, intent extraction. Not just for writing emails.

6. **Loose coupling between channels and workflows.** A lead can come from Tally, email forward, SMS, or call. The webhook normalizes to a `LeadIntakeInput` and triggers the same `leadIntakeWorkflow`. Adding new channels later means adding a normalizer, not changing the workflow.

7. **Defensive coding always.** Every webhook validates input with Zod. Every external API call has retry logic. Every workflow step is independently retryable. Every UI has loading and error states.

8. **No premature optimization.** First 5-10 clients get simple direct queries. No caching layers, no queue tuning, no read replicas. Optimize when there's a real performance problem.

## Stack (locked)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 App Router | Server Components by default, Client only when needed |
| Language | TypeScript (strict mode) | No `any`, no implicit `any`, exhaustive switches |
| DB | Postgres via Vercel Postgres (Neon) | Free tier 500MB to start |
| ORM | Drizzle | Schema in `lib/db/schema.ts`, queries in `lib/db/queries.ts` |
| Auth | Clerk | Free tier up to 10K MAU |
| Workflows | `workflow` SDK from Vercel | GA, install with `pnpm add workflow` |
| AI SDK | `ai` v7 from Vercel | Use `generateObject` for structured output, `generateText` for prose |
| AI provider | OpenAI via AI Gateway | Default model: `openai/gpt-4o-mini`. Use `openai/gpt-4o` only when explicitly needed |
| Email send | Resend | React Email templates. SDK: `resend` |
| Email inbound | Resend Inbound | Configure MX for `inbox.<domain>` subdomain |
| SMS | Twilio | Account already exists — credentials provided by Juan |
| Voice | Twilio Voice + TwiML | Missed call handling only, no voice AI |
| File storage | Cloudflare R2 | Free tier 10GB, S3-compatible API |
| Error monitoring | Sentry | Free tier |
| Logging | Console initially, Axiom if needed | Don't add a logging service preemptively |
| Validation | Zod | Schemas shared between client and server |
| Forms | Conform | Server-actions-friendly |
| UI | Tailwind + shadcn/ui | Locked. Use shadcn CLI to add components |
| Email templates | React Email | JSX templates render to email-safe HTML |
| Cron | Vercel Cron | For dailyBriefingWorkflow trigger |
| Package manager | pnpm | Faster than npm, better monorepo support if ever needed |

### NOT in the stack

Do not introduce these without explicit CTO approval:

- Prisma (we use Drizzle)
- Supabase (we use Vercel Postgres)
- Trigger.dev / Inngest (we use Vercel Workflows)
- LangChain / LlamaIndex (we use Vercel AI SDK directly)
- tRPC (Next.js Server Actions are sufficient)
- Redux / Zustand for global state (use Server Components + URL state)
- Any UI library that isn't shadcn/ui
- Stripe (manual invoicing for first clients)
- Native mobile dependencies (responsive web only)

## Locked decisions (don't relitigate)

These are committed. If you think one is wrong, raise it in `QUESTIONS.md`, do not deviate.

### Product
1. V1 = single agent, manual onboarding, English-only UI, bilingual lead messaging
2. 4 web app pages (setup wizard, inbox, lead detail, settings) — nothing more
3. 4 channels in (Tally, email forward, SMS inbound, missed call) — nothing more
4. Day 1/3/7 follow-up sequence — not customizable per agent in V1
5. AI provider is OpenAI gpt-4o-mini default
6. Voicemail recording is V1 (browser MediaRecorder + R2 upload)
7. No Voice AI, no Facebook/Instagram/WhatsApp, no MLS

### Technical
8. Postgres is the only DB. No Airtable, no Supabase
9. Vercel Workflows for all durable work
10. Drizzle ORM (not Prisma)
11. Resend for email (send + inbound)
12. Twilio for SMS and voice
13. Cloudflare R2 for audio storage
14. Light mode only in V1 (dark mode is V2)
15. Primary color: emerald-500 (#10B981)
16. Typography: Geist Sans

### Business / scope
17. Manual invoicing for first 1-3 clients (no Stripe in V1)
18. Pricing: $99/mo target, TBD by Juan
19. Target: first paying client by week 8-10

## Database schema (Drizzle)

This is the V1 schema. Implement this exactly. Migrations go in `drizzle/migrations/`.

```typescript
// lib/db/schema.ts
import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, date } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  twilioNumber: text('twilio_number').unique(),
  calendlyUrl: text('calendly_url'),
  marketArea: text('market_area'),
  preferredLanguage: text('preferred_language').default('en'), // 'en' | 'es'
  voicemailUrl: text('voicemail_url'),
  timezone: text('timezone').default('America/New_York'),
  inboundEmailAlias: text('inbound_email_alias').unique(), // ej: juan@inbox.homebase.app
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  
  budget: text('budget'),
  neighborhood: text('neighborhood'),
  reason: text('reason'),
  timeline: text('timeline'),
  detectedLanguage: text('detected_language').default('en'), // 'en' | 'es'
  
  aiScore: text('ai_score'), // 'hot' | 'warm' | 'cold'
  aiReasoning: text('ai_reasoning'),
  suggestedAction: text('suggested_action'),
  priority: integer('priority'), // 1-100, lower is higher priority
  
  status: text('status').default('new').notNull(),
  // 'new' | 'contacted' | 'in_conversation' | 'scheduled' | 'won' | 'lost' | 'opted_out'
  followUpStage: integer('follow_up_stage').default(0).notNull(),
  // 0 (not started) | 1 (day 1 sent) | 3 (day 3 sent) | 7 (day 7 sent) | -1 (stopped)
  paused: boolean('paused').default(false).notNull(),
  
  source: text('source').notNull(), // 'tally' | 'email' | 'sms' | 'call'
  sourceMetadata: jsonb('source_metadata'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastContactAt: timestamp('last_contact_at'),
  repliedAt: timestamp('replied_at'),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  
  direction: text('direction').notNull(), // 'inbound' | 'outbound'
  channel: text('channel').notNull(), // 'email' | 'sms' | 'call' | 'note'
  content: text('content').notNull(),
  subject: text('subject'), // for emails
  
  aiGenerated: boolean('ai_generated').default(false).notNull(),
  aiModel: text('ai_model'),
  
  detectedIntent: text('detected_intent'),
  // 'interest_high' | 'objection_price' | 'request_info' | 'scheduling' | 'opt_out' | 'other'
  detectedLanguage: text('detected_language'),
  
  externalId: text('external_id'), // Twilio SID, Resend message ID, etc.
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowRuns = pgTable('workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  workflowName: text('workflow_name').notNull(),
  status: text('status').notNull(), // 'running' | 'completed' | 'failed'
  vercelRunId: text('vercel_run_id'),
  error: text('error'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const briefings = pgTable('briefings', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  language: text('language').default('en').notNull(),
  summary: text('summary').notNull(),
  hotLeadIds: uuid('hot_lead_ids').array(),
  newRepliesCount: integer('new_replies_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Indexes to create
- `leads.agent_id` (for dashboard queries)
- `leads.status` (for filtering)
- `leads.created_at DESC` (for sorting)
- `messages.lead_id, created_at DESC` (for timeline)
- `workflow_runs.lead_id, started_at DESC` (for debugging)

## Folder structure

```
homebase/
├── app/
│   ├── (marketing)/
│   │   └── page.tsx                    # landing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── setup/page.tsx              # setup wizard (4 steps)
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # sidebar nav
│   │   ├── inbox/page.tsx              # unified inbox
│   │   ├── leads/[id]/page.tsx         # lead detail
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── tally/route.ts
│   │   │   ├── twilio/sms/route.ts
│   │   │   ├── twilio/voice/route.ts
│   │   │   └── email/route.ts
│   │   ├── agents/route.ts
│   │   └── leads/[id]/route.ts
│   └── layout.tsx
├── workflows/
│   ├── lead-intake.ts                  # 'use workflow'
│   ├── follow-up-sequence.ts
│   ├── reply-handler.ts
│   └── daily-briefing.ts
├── lib/
│   ├── ai/
│   │   ├── score-lead.ts
│   │   ├── generate-reply.ts
│   │   ├── detect-language.ts
│   │   ├── classify-intent.ts
│   │   └── generate-briefing.ts
│   ├── channels/
│   │   ├── email.ts                    # Resend send + parse helpers
│   │   ├── sms.ts                      # Twilio send + parse
│   │   └── voice.ts                    # Twilio TwiML helpers
│   ├── db/
│   │   ├── schema.ts
│   │   ├── client.ts
│   │   └── queries.ts                  # reusable queries
│   ├── prompts/
│   │   ├── score-lead.ts
│   │   ├── reply-en.ts
│   │   ├── reply-es.ts
│   │   ├── classify-intent.ts
│   │   └── briefing.ts
│   ├── auth/
│   │   └── clerk.ts                    # Clerk helpers
│   └── utils.ts
├── emails/                             # React Email templates
│   ├── follow-up-day1-en.tsx
│   ├── follow-up-day1-es.tsx
│   ├── follow-up-day3-en.tsx
│   ├── follow-up-day3-es.tsx
│   ├── follow-up-day7-en.tsx
│   ├── follow-up-day7-es.tsx
│   └── briefing-en.tsx
│   └── briefing-es.tsx
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── leads/                          # lead-specific components
│   ├── inbox/
│   └── settings/
├── drizzle/
│   ├── migrations/
│   └── schema.ts                       # drizzle config
├── specs/                              # specs from CTO
│   ├── workflows/
│   └── pages/
├── CLAUDE.md                           # this file
├── QUESTIONS.md                        # your questions for CTO
├── PROGRESS.md                         # what's done, what's next
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Code conventions

### General
- TypeScript strict mode. No `any`. No `as` casts unless absolutely required (and commented).
- Server Components by default. Client Components only when you need interactivity, browser APIs, or hooks.
- Use Server Actions for mutations. Don't create API routes for things the dashboard does.
- API routes are ONLY for: webhooks (external systems calling in), and any case where Server Actions don't work.

### Database
- All queries through Drizzle, no raw SQL unless explained why.
- Reusable queries live in `lib/db/queries.ts`. Inline queries fine for one-offs.
- Always include `agentId` in WHERE clauses for multi-tenant safety even though we have 1 agent in V1.

### AI calls
- Use `generateObject` with Zod schemas when you need structured output (scoring, classification).
- Use `generateText` only when you need free-form text (email body).
- Always set `model` explicitly. Never default.
- Always have a fallback for when AI returns garbage. The workflow continues with sane defaults if AI fails.
- Log AI calls to `workflow_runs.metadata` with token counts for cost tracking.

### Workflows
- Every Vercel Workflow file starts with `'use workflow'`.
- Every external call (DB write, AI call, send email) is wrapped in `step()`.
- Steps must be idempotent — they may retry.
- Use `sleep()` for delays, never `setTimeout`.
- Workflow inputs and outputs must be JSON-serializable (no Date objects, use ISO strings).
- Name steps descriptively: `step('send-day-1-followup', ...)` not `step('send-email', ...)`.

### Forms and validation
- All forms use Zod schemas defined in a single file per feature.
- Same schema validates client-side and in Server Action.
- Use Conform for form state.

### Naming
- Components: PascalCase, named for what they DO (e.g., `LeadStatusBadge`, not `OrangePill`).
- Files: kebab-case for files, PascalCase for component files.
- Functions: camelCase, verbs (`scoreLead`, `sendFollowUp`).
- Database columns: snake_case in DB, camelCase in TypeScript via Drizzle.

### Error handling
- Webhooks always return 200 unless the request is malformed. Failures get logged and retried internally.
- Server Actions return discriminated unions: `{ ok: true, data } | { ok: false, error }`.
- UI shows errors via shadcn `<Alert>` or toast (no `alert()`).
- All errors that aren't user-input errors get sent to Sentry.

### Comments
- Comment WHY, not WHAT. The code shows what.
- If a decision is non-obvious, leave a comment explaining why we chose this path.
- TODO comments must include date and reason.

## Workflow of delivery

You work in **units**. A unit is one complete, testable piece of the project. Examples of units:

- Setup foundation (Week 1)
- Lead intake workflow + Tally webhook (Week 2)
- Follow-up sequence workflow (Week 3)
- Reply handler workflow (Week 4)
- Inbox page (Week 5a)
- Lead detail page (Week 5b)
- Settings page (Week 6a)
- Setup wizard (Week 6b)
- Daily briefing workflow (Week 6c)
- Twilio voice + missed call (Week 7)
- Polish + first client onboarding (Week 8)

When you finish a unit:

1. Update `PROGRESS.md` with what's done, what's next, and any notes.
2. Update `QUESTIONS.md` if you hit decisions you couldn't make.
3. Commit your work with a clear message. Format: `feat(workflow): lead-intake end-to-end working`.
4. Tell Juan: "Unit X is done. CTO can review."

The CTO will review and give you one of three responses:
- **APPROVE** — pass, move to next unit
- **CHANGES REQUESTED** — list of specific items to fix before approval
- **BLOCKED** — there's a structural issue, stop and re-plan

You don't move to the next unit without APPROVE.

## When in doubt

| Situation | Action |
|-----------|--------|
| Architecture or tech stack question | Re-read this doc. If still unclear, write in QUESTIONS.md |
| Product feature question | Always QUESTIONS.md. Never assume. |
| Library choice not in stack | QUESTIONS.md before installing |
| Schema change | QUESTIONS.md (we're stable on V1 schema) |
| Performance optimization | Don't. We don't optimize before having problems. |
| New external service (anything not in stack table) | QUESTIONS.md |
| Bug in someone else's code | Fix it, mention in PROGRESS.md |
| Code style choice | Follow existing patterns. If none, follow conventions section. |

## Out of scope (V2 or later)

The following are NOT in V1. If Juan or the user prompt suggests adding any, push back and refer to this list:

- Pipeline kanban / board view
- Custom fields / tags
- Calendar sync (Google/Outlook)
- Bulk actions / mass email / mass SMS
- CSV import
- Email composition from scratch in the app (drafts via reply-handler is fine)
- Power dialer / click-to-call from app
- Zapier / make.com integrations
- Facebook Lead Ads webhook
- Zillow / Realtor.com integration
- WhatsApp / Instagram channels
- Voice AI (inbound or outbound)
- MLS integration
- Transaction management / e-signature
- Native mobile apps
- Bilingual UI (only bilingual lead messaging in V1)
- Self-serve signup
- Stripe billing
- Multi-agent / team accounts
- Dark mode
- Detailed analytics dashboards
- AI voice cloning
- Birthday / anniversary automated messages
- Open house follow-up sequences
- Long-term nurture campaigns
- Referral / commission tracking
- Document storage
- Drip campaign visual editor

## Reference: Spec documents

Detailed specs for each unit live in `/specs/`:

- `specs/workflows/01-lead-intake.md`
- `specs/workflows/02-follow-up-sequence.md`
- `specs/workflows/03-reply-handler.md`
- `specs/workflows/04-daily-briefing.md`
- `specs/pages/01-setup-wizard.md`
- `specs/pages/02-inbox.md`
- `specs/pages/03-lead-detail.md`
- `specs/pages/04-settings.md`

Read the relevant spec before starting a unit. The spec has acceptance criteria — your code is not done until those pass.

---

End of CLAUDE.md. This document is updated by the CTO when locked decisions change. Do not edit it yourself.
