# QUESTIONS for CTO

Open questions blocking or shaping work. CTO answers in-place; I clear answered items at the start of the next unit.

---

## Open

_None right now. Foundation Unit questions Q1–Q7 were all answered (see "Resolved" below). Q8–Q11 are parked until their respective units begin (Lead Intake, Settings, Daily Briefing) and will be re-raised then._

---

## Resolved (Foundation Unit)

- **Q1. Domain** → A1: use `*.vercel.app` for Week 1. Don't hardcode `homebase.app`. Use env var `INBOUND_EMAIL_DOMAIN` (empty string default for Week 1, becomes `inbox.firstresponder.app` later).
- **Q2. Vercel project** → A2: doesn't exist; Juan creates it as `homebase-isa` and imports the GitHub repo.
- **Q3. Postgres** → A3: Path A (Vercel Marketplace → Neon), DB `shy-bird-61622677`. App reads `DATABASE_URL` (pooled), migrations read `DATABASE_URL_UNPOOLED`. No `POSTGRES_URL` fallback.
- **Q4. Clerk app** → A4: exists. Email + password only, social/phone/magic-link disabled.
- **Q5. Clerk → agents sync** → A5: lazy upsert (Path B), no webhook. Helper `ensureAgent()` cached for request lifecycle. Row created with `onboardingCompleted=false`. Setup-wizard routing deferred to its unit.
- **Q6. Sentry** → A6: only `NEXT_PUBLIC_SENTRY_DSN` for V1. Skip `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. Test endpoint `/api/sentry-test` deliberately throws.
- **Q7. Sign-up gating** → No answer needed in V1; Clerk sign-up is open until first paying client approaches.

---

## Parked (raise when their unit starts)

### Q8. Lead Intake — Vercel AI Gateway readiness
Does a Gateway project + API key exist already, or do we set it up at the start of Week 2?

### Q9. Lead Intake — Resend domain verification
Sending from `juan@inbox.firstresponder.app` requires SPF/DKIM/DMARC on the real domain. DNS access needed before Lead Intake unit ships.

### Q10. Settings — voicemail format conversion
Spec mentions FFmpeg in a Vercel Function for webm → MP3. Vercel Functions don't ship FFmpeg by default. Recommendation: first verify Twilio `<Play>` accepts raw browser output before adding a transcoder.

### Q11. Daily Briefing — cron strategy
Spec calls for a 30-min cron 24/7. Vercel Hobby caps cron at 2/day; needs Pro plan. Confirm we're on Pro before Week 6.
