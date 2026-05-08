# CTO Review Process

How the CTO (me, the virtual senior engineer in Claude.ai chat) reviews work that Claude Code produces. This document defines what gets checked, how, and how feedback flows back.

## The unit of review: workflows and pages

Each "unit" of work is one workflow OR one page. A unit is reviewable independently. The full project has ~10 units (4 workflows + 4 pages + foundation + integration).

Claude Code finishes a unit, marks it ready in `PROGRESS.md`, and Juan tells the CTO: "Unit X is ready for review."

## What the CTO reviews

For every unit, the CTO checks against 4 dimensions. All 4 must pass for APPROVE.

### 1. Spec adherence
- All acceptance criteria from the spec doc pass
- No missing features
- No surprise extras (scope creep)
- Tests/manual test logs included

### 2. Architecture and code quality
- Follows the patterns in CLAUDE.md
- Stack matches CLAUDE.md (no new libraries without approval)
- Folder structure matches
- No `any` types
- Proper error handling
- Reusable code extracted (no copy-paste of >10 lines)
- Comments explain WHY where non-obvious
- Database queries have agent-scoping for multi-tenant safety

### 3. Functional correctness (CTO-tested where possible)
- The CTO will run the code mentally and trace through expected vs actual behavior
- For workflows: trace through happy path + 2-3 edge cases
- For pages: trace through user flows
- The CTO will flag anything that LOOKS like it would break in production

### 4. Production-readiness
- Loading states
- Error states
- Empty states
- Mobile responsive (for pages)
- Logging/Sentry coverage
- Performance (no obvious N+1, no unbounded queries)
- Multi-tenancy (the #1 critical safety issue)

## The CTO's review output

For each unit reviewed, the CTO produces a structured response:

### APPROVE format
```
## REVIEW: Unit {name} — APPROVE ✓

**Tested mentally:**
- Happy path: pass
- Edge case 1: pass
- Edge case 2: pass

**Spec adherence:** All 14 criteria met

**Code quality:** Clean. Notes:
- {short positive notes if any}
- {minor things to address in future units, no blocker}

**Next unit:** Start unit {next}.
```

### CHANGES REQUESTED format
```
## REVIEW: Unit {name} — CHANGES REQUESTED

**Blockers (must fix before next unit):**
1. {specific issue with file/line reference}
2. {specific issue}

**Recommendations (do these but don't block):**
- {thing to consider}

**Re-test focus after fix:** {what specifically to test again}
```

### BLOCKED format
```
## REVIEW: Unit {name} — BLOCKED 🚧

**Structural issue identified:** {what's wrong at architecture level}

**Why this blocks progress:** {downstream impact}

**Proposed fix:** {options}

**Action required:** Discuss with Juan before any further code.
```

## How Juan facilitates the review

Juan's role in review is minimal. Specifically:

1. Juan tells the CTO when a unit is ready ("Unit X done")
2. Juan pastes (or links) Claude Code's deliverable: PROGRESS.md, key files, test logs
3. Juan relays the CTO's response back to Claude Code
4. If the CTO has product questions in the review, Juan answers them

Juan should NOT:
- Pre-review work himself before showing the CTO (we want to catch issues)
- Filter the CTO's feedback
- Skip review when "it looks fine"

## What Claude Code provides for review

When marking a unit ready, Claude Code produces:

1. **Updated `PROGRESS.md`** with what's done and what's next
2. **Test log** in the PR or as a comment: what was tested, what passed
3. **`QUESTIONS.md`** if any questions arose (CTO answers in the review)
4. **A short summary message** like:
   > "Unit 2 (Lead Intake Workflow) ready for review.
   > 
   > Tested:
   > - 3 EN test payloads → emails received in <30s
   > - 3 ES test payloads → Spanish emails received
   > - Malformed payload → graceful error
   > - AI failure simulation → fallback worked
   > 
   > Notes:
   > - Used `@upstash/ratelimit` for webhook rate limiting (justification: protects against spam)
   > - Resend dashboard link: ...
   > 
   > Files added/changed: app/api/webhooks/tally/route.ts, workflows/lead-intake.ts, lib/ai/score-lead.ts, ..."

This summary is what Juan pastes into the CTO chat.

## Review cadence

- **Target:** every 1-2 days of Claude Code work, one unit done, one review
- **Review turnaround:** CTO responds within the same chat session (no overnight wait)
- **If CHANGES REQUESTED:** Claude Code addresses, re-submits, CTO re-reviews. Usually <30 min loop.
- **If BLOCKED:** discussion happens in chat, often involves Juan making a product call. Then Claude Code adjusts.

## Things the CTO will be ESPECIALLY strict about

These are areas where mistakes are expensive to fix later:

1. **Multi-tenancy.** Every query that returns lead/message data MUST scope to `agentId`. Missing scoping = data leak between agents. The CTO will check every query.

2. **AI cost control.** AI calls without `model` set, or accidentally using `gpt-4o` instead of `gpt-4o-mini` = 30x cost. The CTO will check every AI call.

3. **Webhook security.** Webhooks from Tally, Twilio, Resend MUST verify signatures (HMAC where supported). Unsigned webhooks = anyone can spoof leads.

4. **Schema migrations.** Any DB schema change must come with a migration file. No raw `ALTER TABLE` in code.

5. **Idempotency in workflows.** Steps run multiple times during retries. If a step says "send email", it must use a deduplication key so the lead doesn't get 5 emails on retry.

6. **Error boundaries.** Failures must not cascade. One failed AI call shouldn't crash the whole workflow.

7. **Logging that includes PII.** Don't log lead emails, phones, or message contents in plain text. Use IDs.

8. **Bilingual quality.** The Spanish output must read like real Spanish, not translated English. The CTO may push back on AI prompts that produce awkward output.

## Things the CTO will NOT block on

These can be deferred or accepted as-is for V1:

- Test coverage <100% (acceptable if happy paths covered)
- Some inline styles (we can refactor later if it's not pervasive)
- Minor accessibility issues (we'll do an a11y pass before launch)
- Performance optimizations beyond "doesn't crash" (premature optimization is forbidden)
- UI polish (this is V1, ship working > ship pretty)

## Review philosophy

The CTO's bias: ship working code fast, catch the things that would hurt in production. Don't be a perfectionist on V1. Don't approve sloppy or unsafe code either. The line is: "would this embarrass us with the first paying client?"

When in doubt, the CTO will ask: "if this breaks, can we fix it in 30 minutes once we notice?" If yes, ship. If no, fix first.

## Escalation path

If Claude Code disagrees with the CTO's review feedback:
1. Claude Code states disagreement with reasoning in the response
2. CTO either updates the position with new reasoning OR holds firm
3. If still disagreement, Juan makes the call (it's his project)

Juan's call is final on product questions. CTO's call is final on technical questions. When unclear which it is, default to Juan.
