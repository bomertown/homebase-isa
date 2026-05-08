# Juan's Operating Manual

What you actually do during the 8-10 weeks of build. Designed to keep your operational load to <2 hours per week.

## Your role in 3 sentences

You are the product owner. Claude Code writes the code. The CTO (me, in chat) reviews and unblocks. You make product decisions, validate things look right, and run point on anything that needs human accounts (Twilio, Vercel, Resend, etc.).

## Weekly time commitment

Realistic estimate per week:
- 1-2 hours of product decisions (questions from CTO and Claude Code)
- 30-60 min of relay (passing messages between Claude Code and CTO)
- 30 min of "does this feel right" gut checks on UI
- Occasional 15-30 min for setting up external accounts

**Total: ~3 hours per week average.** Some weeks will be 1 hr, some 5 hrs (especially Week 1 with all the account setup).

## Setup tasks (Week 0, before any code)

These are one-time and only you can do them. Block one focused afternoon, do them all.

### Accounts to create or activate
- [ ] **Vercel account** with Pro plan ($20/mo) — needed because Hobby caps functions at 60s which kills AI agents
- [ ] **GitHub repo** for the new project (let Claude Code suggest a name, or use `homebase-isa` for now)
- [ ] **Clerk account** (free tier) — get publishable + secret keys
- [ ] **Vercel Postgres** (or Neon) provisioned and connected to Vercel project — get DATABASE_URL
- [ ] **OpenAI account** OR use Vercel AI Gateway (recommended) — get API key
- [ ] **Resend account** — verify your domain, set up DKIM/SPF
- [ ] **Cloudflare R2** — create bucket, generate API tokens
- [ ] **Sentry** (free tier) — get DSN
- [ ] **Twilio** — already done; just verify A2P 10DLC registration is in progress (or postponed per V1 plan)

### Domain setup
- [ ] Decide on the final domain name (the open question from your original docs)
- [ ] Buy domain
- [ ] Connect to Vercel
- [ ] Configure MX records for `inbox.<domain>` to route to Resend Inbound Parse
- [ ] Configure SPF/DKIM/DMARC for outbound email reputation

### Hand-off to Claude Code
- [ ] Create a `.env.local` template with all required keys (Claude Code can do this part)
- [ ] Add all keys to Vercel project environment variables
- [ ] Make sure Claude Code has access to the GitHub repo

You do NOT need to:
- Set up the database schema (Claude Code does)
- Write any code
- Configure Drizzle, Workflows, or anything else
- Build the UI

## Weekly cadence (Weeks 1-8)

### Monday: Quick check-in (15 min)
- Open the Claude.ai chat with CTO (this chat thread or a successor)
- Open Claude Code session
- Look at `PROGRESS.md` from Claude Code's last session
- Ask CTO: "What's the focus for this week?"

### During the week: Async availability (1-2 hrs total)
- Watch for messages from Claude Code marked "QUESTION" or "ready for review"
- When Claude Code marks a unit ready: paste the summary into CTO chat, get review, relay back
- When CTO has a product question: answer it in the chat or in Claude Code's `QUESTIONS.md`
- When you see something off in the UI (you'll deploy preview branches and click around): tell the CTO

### Friday: Demo to yourself (30 min)
- Pull the latest deployment
- Walk through what was built that week as if you were a user
- Note anything weird, broken, or confusing
- Send these notes to the CTO

This Friday demo is your most important quality gate. The CTO can catch architectural issues, but only YOU can catch "this feels wrong as a user."

## Specific things only you can do

### Product decisions
- Final product name (when ready to launch)
- Tone of AI emails (formal vs casual)
- Subject lines for follow-up emails (CTO will draft, you approve)
- Pricing (when ready to charge first client)
- First client to target

### Brand decisions
- Final logo (you can generate with v0 or a designer)
- Colors beyond the locked emerald (if you want to add accent colors)
- Marketing copy on the landing page

### Validation tasks
- Be the first test lead (use your real email/phone)
- Verify the daily briefing arrives in your inbox at the right time
- Verify follow-up emails sound natural in both languages
- Verify the missed-call SMS sounds like you wrote it

### External integrations you own
- A2P 10DLC registration with Twilio (when ready for first paying client)
- Domain DNS configuration
- LLC formation if needed for A2P (talk to your parents)

### Customer-facing tasks (Week 8+)
- Onboarding the first client (30-60 min Zoom)
- Writing the demo Loom
- Responding to first-client feedback

## What you should NOT do

- Don't write code yourself. You'll slow Claude Code and confuse the architecture.
- Don't make architectural decisions without consulting CTO. Ask first.
- Don't add features mid-week. Note them, discuss in next week's planning.
- Don't accept "good enough" without showing CTO. Trust the review process.
- Don't skip the Friday demo. It's the single most valuable hour of your week.

## When something goes wrong

### Claude Code is stuck
- Paste the question/error into CTO chat
- CTO will diagnose and respond with guidance
- You relay back

### Something in production breaks
- Don't panic
- Check Sentry for the error
- Tell CTO with details (what user did, what error shows)
- CTO and Claude Code will produce a fix
- You ship the fix to Vercel via Claude Code

### You disagree with CTO
- Tell CTO you disagree and why
- We discuss, one of us updates position
- If still disagreement, you decide (it's your product)

### You disagree with Claude Code
- CTO mediates
- Claude Code follows what CTO/you decide

## Communication patterns

### Good message to CTO when relaying from Claude Code
```
"Claude Code finished Unit 3 (Reply Handler).
Here's the summary they wrote: [paste]
Files changed: [paste list]
Test log: [paste]
Their question for us: [the question if any]"
```

### Good message to Claude Code when relaying from CTO
```
"CTO reviewed. APPROVED. Notes:
- {paste notes}
Move to Unit 4."
```

### Good message when YOU need a decision from CTO
```
"Question: [your question]
Context: [what you saw, what you're worried about]
What I'm leaning towards: [your gut]"
```

This last format is the most important. Pre-thinking your question saves CTO time and gets you better answers.

## Tools you'll use

- **Claude.ai chat** — for CTO reviews and questions (this thread or its successor)
- **Claude Code** — for actually writing code (separate sessions/tools)
- **Vercel dashboard** — for deploys, logs, env vars
- **GitHub** — for repo, PRs (Claude Code commits, you approve)
- **Resend dashboard** — for verifying emails went out
- **Twilio console** — for SMS logs
- **Sentry** — for error monitoring
- **A spreadsheet or Notion** — for tracking your test scenarios and notes

## Checkpoint: when can you start selling?

Don't try to sell before all of these are true:

- [ ] All 4 workflows working end-to-end with real (not synthetic) data
- [ ] All 4 pages deployed and functional
- [ ] You've onboarded YOURSELF as a test agent and used it for a week
- [ ] At least 5 hot leads in the system processed correctly
- [ ] Daily briefings arriving correctly for 7 consecutive days
- [ ] No critical Sentry errors in the past 7 days
- [ ] Voicemail recording → playback via Twilio works
- [ ] CTO has signed off on production-readiness

If even one of these isn't true, you're not ready. Don't push it.

## Your week 0 checklist (do this first)

- [ ] Read CLAUDE.md fully
- [ ] Read all 4 workflow specs
- [ ] Read all 4 page specs
- [ ] Read this manual
- [ ] Set up all accounts in the "Setup tasks" section above
- [ ] Decide: are you all-in on this for 8-10 weeks?
- [ ] If yes: tell CTO "ready to start Week 1" and we go.
