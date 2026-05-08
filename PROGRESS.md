# PROGRESS

Source of truth for what's done and what's next. Updated at the end of every unit.

---

## Current unit: **Foundation (Week 1)** — CODE READY, AWAITING DEPLOY

### Goal
Plumbing only. No product features. Vercel deploy where a user can sign up via Clerk and land on a blank `/inbox`, with Drizzle migrated against Neon and Sentry capturing errors.

### Acceptance criteria
- [ ] App deploys successfully to Vercel
- [ ] Sign up via Clerk and land on `/inbox` while authenticated
- [ ] DB schema is migrated and visible in Neon
- [ ] Sentry receives a test error from the app

### What I've built locally

- Next.js 14.2.33 + TypeScript 5.7 in **strict mode** (`noImplicitAny`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`).
- pnpm pinned to **9.15.4** (avoids pnpm 11's build-script approval gate that would trip up Vercel).
- Tailwind v3.4 + shadcn/ui scaffolding (`components.json`, `lib/utils.ts`, primary color `emerald-500` per CLAUDE.md, Geist fonts wired).
- **Drizzle ORM** with the exact schema from CLAUDE.md (`agents`, `leads`, `messages`, `workflow_runs`, `briefings`) plus all listed indexes. Migration generated → `drizzle/migrations/0000_sweet_galactus.sql`.
- DB client (`lib/db/client.ts`) reads `DATABASE_URL` (pooled, app); migrations read `DATABASE_URL_UNPOOLED` per CTO answer A3. Lazy-init via Proxy so missing env at build time doesn't crash bundling.
- **Clerk** wired (`@clerk/nextjs` v6.39): `ClerkProvider` in root layout, `clerkMiddleware` protecting all routes except `/sign-in`, `/sign-up`, and `/api/sentry-test`. Catch-all sign-in/sign-up pages.
- Lazy `agents` upsert helper (`lib/auth/clerk.ts` → `ensureAgent()`) per CTO answer A5. React.cache for request lifecycle. Called from `app/(dashboard)/layout.tsx` so every dashboard request guarantees an `agents` row.
- **Sentry** (`@sentry/nextjs` v8.55): server, edge, client configs; `instrumentation.ts` with `onRequestError = Sentry.captureRequestError`. Source-map upload intentionally disabled (CTO answer A6 — `SENTRY_AUTH_TOKEN` skipped for V1).
- Test endpoint `/api/sentry-test` that throws an `Error` on GET. Public (allow-listed in middleware). Curl it once after deploy → confirm event in Sentry → leave in place.
- Empty `/inbox` page rendering the word "Inbox", protected by middleware.
- ESLint with `@typescript-eslint/no-explicit-any: error`.

Local checks all green:
- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm build` ✓ (verified with placeholder Clerk keys; routes correctly classified as static `○` for `/` and `/_not-found`, dynamic `ƒ` for `/inbox`, `/api/sentry-test`, `/sign-in`, `/sign-up`)

### What you need to do, in order

1. **Push this branch to GitHub** (it's already on `main`, just push).
2. **Create the Vercel project** named `homebase-isa`. Import from `github.com/bomertown/homebase-isa`. Framework auto-detects as Next.js. Build command stays default (`pnpm build`). Install command: `pnpm install`. Root directory: `.`.
3. **Link the orphaned Neon DB `shy-bird-61622677`** to the Vercel project via Storage → Connect Database. Vercel will auto-inject `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and a few others into all environments.
4. **Paste these env vars** into Vercel project → Settings → Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` = `/inbox`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` = `/inbox`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `INBOUND_EMAIL_DOMAIN` = (leave empty for Week 1)
5. **Configure Clerk redirect URLs** in the Clerk dashboard → "Domains" tab → add the `*.vercel.app` URL once Vercel assigns it. Allowed origins: same URL.
6. **Run the migration against Neon** — easiest path: pull env vars locally then run migrate. From a terminal in this repo:
   ```bash
   vercel env pull .env.local        # (after `vercel link`) — or paste manually from Neon dashboard
   pnpm install
   pnpm db:migrate
   ```
   Verify in Neon dashboard → Tables: `agents`, `leads`, `messages`, `workflow_runs`, `briefings` plus `__drizzle_migrations` exist.
7. **Smoke test** on the deployed `*.vercel.app` URL:
   - Visit `/` → should redirect to `/inbox` → middleware kicks you to `/sign-in`.
   - Sign up with email + password.
   - You land on `/inbox`. The dashboard layout's `ensureAgent()` inserts your row into `agents`. Verify in Neon: one row with your `clerk_user_id`.
   - `curl https://<your-domain>/api/sentry-test` → 500 response. Open Sentry dashboard within 30 seconds → see the captured error.

When all four acceptance criteria pass, message me with "ready for CTO review" and I'll close out the unit and post the handoff.

### Known TODOs deferred (with reasons)

- **Sentry source-map upload** — needs `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Skipped per A6. Add when stack traces become unreadable.
- **Migrations in CI/build pipeline** — currently manual one-shot. Will add `pnpm db:migrate` to the Vercel build command (or a separate hook) in Week 2 once we have a second migration to validate the pattern.
- **`/setup` routing** for non-onboarded agents — per A5, deferred to the Setup Wizard unit (Week 6b). The `agents` row gets created with `onboardingCompleted=false` but `/inbox` doesn't yet check that flag.

### Decisions worth flagging for the CTO

- **pnpm 9.15.4 vs newer**: pnpm 10/11 added a build-script approval system that requires a separate `pnpm-workspace.yaml` `allowBuilds:` block; Vercel's pnpm support is most stable on 9.x as of now. We can revisit when Vercel publishes guidance for pnpm 10+.
- **Lazy DB client via Proxy** (`lib/db/client.ts`): safer than throwing at module load because `next build` evaluates server-component module graphs; a hard throw at top level would crash the build for any preview where env vars aren't yet set.
- **Migration generation under the random hash** (`0000_sweet_galactus.sql`): drizzle-kit names migrations with random words. Locked in. Don't rename.

---

## Backlog (units after Foundation)
- Week 2 — Lead Intake workflow + Tally webhook
- Week 3 — Follow-Up Sequence workflow
- Week 4 — Reply Handler workflow
- Week 5a — Inbox page (real lead list)
- Week 5b — Lead Detail page
- Week 6a — Settings page
- Week 6b — Setup Wizard
- Week 6c — Daily Briefing workflow
- Week 7 — Twilio voice + missed call
- Week 8 — Polish + first client onboarding
