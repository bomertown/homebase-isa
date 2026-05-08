# Workflow Spec: Follow-Up Sequence

**Goal:** Send Day 1, Day 3, and Day 7 follow-up emails to leads who haven't replied. Stop sequence automatically when lead replies, opts out, or is paused.

**Workflow file:** `workflows/follow-up-sequence.ts`  
**Trigger:** Started by `leadIntakeWorkflow` after initial response is sent.  
**Estimated execution time:** ~7 days (mostly sleeping)  
**Durability:** Critical — the whole point. Survives deploys, restarts, AI failures.

This workflow is the canonical example of why we use Vercel Workflows. A traditional cron-based approach scans the whole DB daily. With durable workflows, each lead has its own workflow that sleeps between actions.

## Inputs

```typescript
type FollowUpSequenceInput = {
  leadId: string;
}
```

That's it. The workflow re-reads lead state from DB at each step.

## Behavior

1. Sleep 1 day
2. Check lead state. If replied/paused/opted_out → exit
3. Send Day 1 follow-up email (AI-generated in lead's language)
4. Sleep 2 more days (total 3)
5. Check lead state. If replied/paused/opted_out → exit
6. Send Day 3 follow-up email
7. Sleep 4 more days (total 7)
8. Check lead state. If replied/paused/opted_out → exit
9. Send Day 7 follow-up email
10. Mark lead `status='cold'` if still no reply

## Steps (in order)

### Step 1: `sleep-1d`
`await sleep('1d');`

For testing, set env var `FOLLOW_UP_TEST_MODE=true` which makes all sleeps `30s` instead.

### Step 2: `check-lead-day1`
Read lead from DB. If any of these conditions:
- `repliedAt !== null`
- `paused === true`
- `status === 'opted_out'`

Then return `{ stopped: 'day1', reason: <which-condition> }`.

### Step 3: `send-day1-email`
Generate Day 1 follow-up email using `generateText` with prompt `lib/prompts/followup-day1-{lang}.ts`.

Tone: friendly check-in, reference what they asked about, reiterate availability.

Send via Resend. Log in `messages` table.

Update lead:
- `followUpStage = 1`
- `lastContactAt = now()`

### Step 4: `sleep-2d`
`await sleep('2d');`

### Step 5: `check-lead-day3`
Same as Step 2 but for Day 3 exit.

### Step 6: `send-day3-email`
Same pattern as Step 3, with Day 3 prompt. Tone: more direct, mention competitive market or whatever feels natural in the language.

Update `followUpStage = 3`.

### Step 7: `sleep-4d`
`await sleep('4d');`

### Step 8: `check-lead-day7`
Same exit checks for Day 7.

### Step 9: `send-day7-email`
Same pattern. Day 7 prompt is the "soft goodbye" — "I'll stop reaching out, here's my number if anything changes."

Update `followUpStage = 7`.

### Step 10: `mark-cold`
Update lead: `status = 'cold'`. This indicates the sequence completed without a reply.

## Error handling

- **AI fails when generating email:** Retry 3x. Then fall back to a hardcoded template per language. Don't skip the email; ANY follow-up is better than none.

- **Email send fails:** Retry 3x. If still failing, log to `workflow_runs.error`, skip that day's email, advance `followUpStage` anyway, and continue. Don't loop forever on a bad email address.

- **DB write fails on stage update:** Critical. Let workflow fail and retry. We need accurate state.

- **Lead is deleted while workflow sleeps:** Step 2/5/8 will return null lead. Treat null as "exit gracefully" — just return, don't error.

## Pause/resume behavior

The agent can pause follow-ups via the lead detail page. This sets `paused = true` on the lead.

- A paused lead will be skipped at the next check step (2, 5, or 8). The workflow exits.
- If the agent un-pauses, the original workflow does NOT resume (it already exited). They have to manually trigger a new sequence — not a V1 feature, just leave it.

In V2 we'll add a UI to manually re-trigger or skip stages. Not in V1.

## Opt-out behavior

If `replyHandlerWorkflow` detects opt-out language ("stop", "unsubscribe", "remove me", etc., or Spanish equivalents), it sets `status = 'opted_out'` AND `paused = true`. This workflow then exits at the next check.

## Acceptance criteria

1. ✅ When started, sleeps for 1 day before doing anything
2. ✅ Day 1 email sent if lead hasn't replied
3. ✅ Day 1 email is in lead's `detectedLanguage`
4. ✅ Day 1 email subject ≠ Day 3 subject ≠ Day 7 subject (different prompts)
5. ✅ Workflow exits cleanly if `repliedAt` is set
6. ✅ Workflow exits cleanly if `paused = true`
7. ✅ Workflow exits cleanly if `status = 'opted_out'`
8. ✅ `followUpStage` updates to 1, 3, 7 as emails go out
9. ✅ After Day 7 with no reply, lead `status = 'cold'`
10. ✅ Workflow visible in Vercel Workflows dashboard with sleep states
11. ✅ Test mode (`FOLLOW_UP_TEST_MODE=true`) reduces sleeps to 30s for testing
12. ✅ All emails logged in `messages` table
13. ✅ Workflow survives a Vercel deploy mid-sleep (durability test)

## Testing approach

**Fast loop (test mode):**
1. Set env var `FOLLOW_UP_TEST_MODE=true` in dev
2. All sleeps become 30s
3. Full sequence runs in ~90 seconds
4. Run 4 scenarios:
   - Lead never replies → all 3 emails sent → status cold
   - Lead replies after Day 1 → Day 3 and Day 7 NOT sent
   - Lead paused after Day 1 → Day 3 and Day 7 NOT sent
   - Lead opts out after Day 1 → Day 3 and Day 7 NOT sent

**Real loop:**
- One canary lead in production where Juan IS the lead. Verify Day 1/3/7 emails arrive at expected times.

**Durability test:**
- Start a workflow in test mode
- During the 30s sleep, deploy a code change
- Verify workflow resumes after deploy and completes successfully

## CTO review checklist

- [ ] All 13 acceptance criteria pass
- [ ] Test mode flag works
- [ ] All sleeps use `sleep()` not `setTimeout`
- [ ] Each email step is independently retryable
- [ ] Exit conditions checked before each send
- [ ] Email prompts in `lib/prompts/` are reviewed by CTO for tone
- [ ] React Email templates render correctly on mobile clients
- [ ] PROGRESS.md updated
