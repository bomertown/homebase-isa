# Workflow Spec: Reply Handler

**Goal:** When a lead replies (any channel), classify their intent with AI, update lead state, and prepare a draft response for the agent.

**Workflow file:** `workflows/reply-handler.ts`  
**Trigger:** Called from `/api/webhooks/email` and `/api/webhooks/twilio/sms` when an inbound message matches an existing lead.  
**Estimated execution time:** 5-15 seconds  
**Durability:** Yes — must not lose replies if AI is down

## Inputs

```typescript
type ReplyInput = {
  leadId: string;
  channel: 'email' | 'sms';
  content: string; // body of the reply (text only, HTML stripped)
  subject?: string; // emails only
  externalId?: string; // Twilio SID or Resend message ID
}
```

The webhook is responsible for matching inbound messages to existing leads. Matching strategy:
- Email: match on `from` address against `leads.email` for the agent (use a Postgres lookup, not iteration)
- SMS: match on `from` phone against `leads.phone` for the agent
- If no match found: log the orphan reply, do not call this workflow. Future feature: orphan replies inbox.

## Outputs

```typescript
type ReplyHandlerOutput = {
  messageId: string;
  intent: IntentType;
  language: 'en' | 'es';
  draftGenerated: boolean;
  notificationSent: boolean;
}
```

## Steps (in order)

### Step 1: `log-inbound-message`
Insert into `messages`:
- `leadId`, `direction='inbound'`, `channel`, `content`, `subject` (if email)
- `externalId`
- `aiGenerated=false`

Capture the inserted message ID.

### Step 2: `classify-intent`
Call `classifyIntent()` from `lib/ai/classify-intent.ts`. Use `generateObject`:

```typescript
const intentSchema = z.object({
  intent: z.enum([
    'interest_high',     // "yes please send me more info"
    'objection_price',   // "too expensive", "out of budget"
    'request_info',      // asking specific questions
    'scheduling',        // wanting to book showing/call
    'opt_out',           // stop, unsubscribe, remove me
    'other',             // catch-all
  ]),
  language: z.enum(['en', 'es']),
  confidence: z.number().min(0).max(1),
  summary: z.string(), // 1 sentence: what does the lead want
});
```

Use `gpt-4o-mini`. Prompt in `lib/prompts/classify-intent.ts`. Include the lead's history (last 5 messages) for context.

Update the message: `detectedIntent`, `detectedLanguage`.

### Step 3: `handle-opt-out` (only if intent === 'opt_out')
If opt-out:
- Update lead: `status='opted_out'`, `paused=true`
- Send a final compliance acknowledgment email/SMS in lead's language ("You've been unsubscribed. We won't contact you again.")
- Skip Steps 4 and 5
- Return early

CAN-SPAM compliance requires the unsubscribe to be honored within 10 business days. We do it immediately.

### Step 4: `update-lead-state`
For non-opt-out replies:
- Set `repliedAt = now()` (this is the signal that follow-up sequence checks)
- Set `status = 'in_conversation'`
- Set `lastContactAt = now()`

### Step 5: `generate-draft-reply`
Call `generateReplyDraft()` from `lib/ai/generate-reply.ts`.

Inputs:
- Full conversation history (all messages between lead and us)
- Detected intent
- Lead context (budget, neighborhood, etc.)
- Agent context (name, phone, calendly)
- Language

Use `gpt-4o-mini` for most cases, `gpt-4o` for `objection_price` and `request_info` (requires more nuance).

Output (use `generateObject`):
```typescript
{
  subject: string, // for email replies; null for SMS
  body: string,
  reasoning: string, // 1 sentence: why this draft
}
```

Save the draft as a `messages` row with `direction='outbound'`, `channel`, `content=body`, `aiGenerated=true`, but ALSO add a flag/field to indicate it's a DRAFT not yet sent. We can either:

**Option A (cleaner):** Add a `drafts` table separate from `messages`.

**Option B (simpler):** Add a `status` column to `messages`: `'sent' | 'draft' | 'discarded'`. Default to `'sent'` for existing rows.

Go with Option B. Update the schema in this PR.

The agent will see the draft in the lead detail page and can:
- Approve and send (changes status to 'sent', triggers actual send via Resend/Twilio)
- Edit and send
- Discard (sets status to 'discarded')

### Step 6: `notify-agent`
Send notification to agent that there's a new reply with a pre-written draft waiting.

V1: send email to agent with subject like "💬 {leadName} replied — draft ready" and body containing:
- Lead name and the reply content
- The classified intent
- The AI-generated draft (preview)
- Link to lead detail page where they can act on it

V2 will add SMS, push, Slack.

## Error handling

- **AI classification fails:** Default intent to `'other'`, language to lead's existing `detectedLanguage`. Skip draft generation. Still notify agent — they can read the reply and respond manually.

- **Draft generation fails:** Skip draft. Notify agent that there's a reply but no draft. They can write one manually.

- **Notification email fails:** Log error, but don't fail the workflow. The lead's reply is still captured in DB; the agent can find it on next dashboard load.

- **Lead not found at any step:** Should not happen (webhook already validated). If it does, log and exit gracefully.

## Edge cases to handle

1. **Lead replies to a follow-up email but their email differs from `leads.email`:** Today's matching is exact email match. Document this limitation. V2: fuzzy matching by name + domain. For V1, log unmatched replies somewhere queryable.

2. **Lead replies multiple times in quick succession (3 emails in 5 minutes):** Each triggers this workflow. Each generates a draft. The agent sees 3 draft messages. That's OK for V1; we can add deduplication later.

3. **Lead's reply contains both opt-out AND interest ("Stop sending these but I do want to see houses"):** Trust the AI classification. If it returns `opt_out`, honor the opt-out. The agent gets notified anyway.

4. **Reply in a different language than initial:** Update `detectedLanguage` on the message but DON'T overwrite the lead's `detectedLanguage`. The lead might just be quoting an email in English. Use the lead's existing language for the draft response unless the classifier confidence is >0.9.

5. **Auto-replies from the lead's email server (vacation responder):** These look like real replies. The classifier should usually mark them `'other'` or `'request_info'`. Acceptable noise for V1. Future: auto-detect vacation responders by header analysis.

## Acceptance criteria

1. ✅ Inbound email matching a lead triggers workflow within 5 seconds
2. ✅ Inbound SMS matching a lead triggers workflow within 5 seconds
3. ✅ Reply is logged in `messages` with `direction='inbound'`
4. ✅ AI correctly classifies intent on test fixtures (≥80% accuracy on 20-sample test set)
5. ✅ Opt-out replies set lead `status='opted_out'` and `paused=true`
6. ✅ Opt-out triggers a final compliance acknowledgment
7. ✅ Non-opt-out replies set `repliedAt`, `status='in_conversation'`
8. ✅ Draft reply is generated and stored as a `messages` row with `status='draft'`
9. ✅ Agent receives notification email with draft preview
10. ✅ `followUpSequenceWorkflow` for this lead exits next time it checks state (because `repliedAt` is set)
11. ✅ Drafts can be sent, edited+sent, or discarded from lead detail page
12. ✅ AI classifies Spanish replies in Spanish correctly
13. ✅ Orphan replies (no matching lead) are logged but don't crash

## Testing approach

**Test data set (20 samples):**
- 4 clear opt-outs (EN: "stop", "unsubscribe me", ES: "no me contactes más", "remover")
- 4 clear high interest (EN: "yes please tell me more", ES: "sí me gustaría ver casas")
- 4 price objections (EN: "way too expensive", ES: "está fuera de mi presupuesto")
- 4 scheduling requests (EN: "can we meet thursday?", ES: "¿nos vemos el jueves?")
- 4 ambiguous (mixed signals, vague requests)

Run the classifier against all 20 manually labeled. Target ≥80% accuracy. If lower, iterate on the prompt before shipping.

**Manual test scenarios:**
1. Send a real test email to `juan@inbox.homebase.app` from a different address that's already in `leads`. Verify full flow.
2. Send an SMS to the Twilio number from a number in `leads`. Verify full flow.
3. Send an opt-out reply. Verify lead is marked opt-out and acknowledgment sent.
4. Send a reply mid-follow-up-sequence. Verify the sequence stops at next check.

## CTO review checklist

- [ ] All 13 acceptance criteria pass
- [ ] Classifier accuracy ≥80% on test set
- [ ] Opt-out compliance flow tested manually
- [ ] Draft system (sent/draft/discarded statuses) works end-to-end
- [ ] No orphan replies crash the system
- [ ] Notifications actually arrive in agent's inbox
- [ ] PROGRESS.md updated
