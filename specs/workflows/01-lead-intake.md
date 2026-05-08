# Workflow Spec: Lead Intake

**Goal:** When a lead arrives from any channel, Homebase responds in the lead's language within 60 seconds with a personalized AI-written email.

**Workflow file:** `workflows/lead-intake.ts`  
**Trigger:** Called from webhook routes (`/api/webhooks/tally`, `/api/webhooks/twilio/sms`, `/api/webhooks/email`, `/api/webhooks/twilio/voice` for missed calls that left a number)  
**Estimated execution time:** 15-45 seconds  
**Durability:** Yes — must survive deploys, retries on AI failures

## Inputs

```typescript
type LeadIntakeInput = {
  agentId: string; // resolved from the inbound channel (Twilio number → agent, email alias → agent, etc.)
  source: 'tally' | 'email' | 'sms' | 'call';
  
  // Captured contact info (some fields optional depending on channel)
  name?: string;
  email?: string;
  phone?: string;
  
  // Captured context (optional)
  budget?: string;
  neighborhood?: string;
  reason?: string; // free text from lead
  timeline?: string;
  
  // Channel-specific metadata
  sourceMetadata?: Record<string, unknown>;
}
```

The webhook normalizes channel-specific payloads into this shape before triggering the workflow. Webhook responsibilities are documented in each webhook route, not here.

## Outputs

```typescript
type LeadIntakeOutput = {
  leadId: string;
  score: 'hot' | 'warm' | 'cold';
  language: 'en' | 'es';
  emailSent: boolean;
  workflowRunId: string;
}
```

## Steps (in order)

### Step 1: `create-lead`
Insert lead into DB with `status='new'`, `followUpStage=0`, all input fields. Capture the inserted ID.

### Step 2: `detect-language`
Call `detectLanguage()` from `lib/ai/detect-language.ts`. Use `generateObject` with schema `{ language: 'en' | 'es', confidence: number }`.

Input to AI: lead's `name + reason + neighborhood` concatenated. If insufficient text, default to agent's `preferredLanguage`.

Update lead `detectedLanguage`.

### Step 3: `score-lead`
Call `scoreLead()` from `lib/ai/score-lead.ts`. Use `generateObject` with this schema:

```typescript
const leadScoringSchema = z.object({
  score: z.enum(['hot', 'warm', 'cold']),
  reasoning: z.string(), // 1-2 sentences
  suggestedAction: z.string(), // 1 sentence, what should agent do first
  priority: z.number().min(1).max(100), // lower = higher priority
});
```

Use `gpt-4o-mini`. Prompt is in `lib/prompts/score-lead.ts`. Include all lead context.

Update lead with all 4 fields.

### Step 4: `generate-email`
Call `generateReply()` from `lib/ai/generate-reply.ts`. Use `generateText` (free-form prose).

Pull the agent's `name`, `phone`, `calendlyUrl`, `marketArea`. Pass to prompt.

Use the EN or ES prompt depending on `detectedLanguage`. Prompts in `lib/prompts/reply-en.ts` and `lib/prompts/reply-es.ts`.

Output should include subject and body. Use `generateObject` with `{ subject: string, body: string }` schema instead of `generateText` — easier to parse.

### Step 5: `send-email`
Call `sendEmail()` from `lib/channels/email.ts`. This wraps Resend.

The `from` address must use the agent's `inboundEmailAlias` so replies route correctly back to us. Format: `"Agent Name" <juan@inbox.homebase.app>`.

The `to` is the lead's email. Skip this step entirely if lead has no email (e.g., SMS-originated lead). In that case, send via SMS instead — see Step 5b.

Capture the Resend message ID for `messages.externalId`.

### Step 5b: `send-sms` (only if lead has no email)
Call `sendSMS()` from `lib/channels/sms.ts`. Uses Twilio.

Truncate the AI message to 320 chars max for SMS (multi-segment). Include Calendly link.

### Step 6: `log-message`
Insert into `messages` table:
- `leadId`, `direction='outbound'`, `channel='email'` or `'sms'`
- `content` = full text sent
- `subject` if email
- `aiGenerated=true`, `aiModel='gpt-4o-mini'`
- `externalId` from Step 5/5b

### Step 7: `update-lead-status`
Update the lead:
- `status='contacted'`
- `lastContactAt=now()`
- `followUpStage=0` (still 0; sequence will move it to 1)

### Step 8: `schedule-followup`
Trigger `followUpSequenceWorkflow` with `{ leadId }`. Use Vercel Workflow's `start()` method, not a recursive call.

This workflow runs separately and is durable across days.

### Step 9: `notify-agent` (only for hot leads in V1)
If `score === 'hot'`, send notification to agent. V1 implementation: email to agent.

V2: SMS notification, push notification, Slack integration.

For V1, just send a simple email to `agent.email` with subject "🔥 Hot lead: {leadName}" and body with lead summary + link to lead detail page.

## Error handling

- **AI call fails (Step 2, 3, 4):** Retry up to 3 times with exponential backoff (Vercel Workflows handles this automatically). After 3 failures, fall back to defaults:
  - Language: agent's `preferredLanguage`
  - Score: `'warm'`, reasoning `'AI scoring unavailable'`, priority 50
  - Email: use a hardcoded fallback template per language with agent's name and Calendly link
  
- **Email send fails (Step 5):** Retry 3 times. If still fails, log to `workflow_runs.error`, mark lead with status `'new'` (not contacted), and continue. Do NOT trigger follow-up sequence — that would compound the failure.

- **DB writes fail:** These are critical. Let the workflow fail entirely. Vercel Workflows will retry the whole step.

- **Lead with no email AND no phone:** This is a malformed lead. Log it, return early after Step 1, don't try to send anything.

## Acceptance criteria

The workflow is complete when ALL of the following pass:

1. ✅ POST to `/api/webhooks/tally` with valid payload → lead in DB within 5 seconds
2. ✅ Lead has correct `detectedLanguage` for both English and Spanish test inputs
3. ✅ Lead has `aiScore`, `aiReasoning`, `suggestedAction`, `priority` populated
4. ✅ Lead receives an email in their language within 60 seconds (P95)
5. ✅ Email is sent FROM the agent's inbound alias (verifiable by Reply-To headers)
6. ✅ `messages` table has the outbound message logged with `aiGenerated=true`
7. ✅ Lead status is `'contacted'` after workflow completes
8. ✅ `followUpSequenceWorkflow` is started (verify in Vercel Workflows dashboard)
9. ✅ Hot leads trigger an agent notification email
10. ✅ Workflow shows up in `workflow_runs` table with status `'completed'`
11. ✅ If AI fails, workflow still completes using fallbacks
12. ✅ If email send fails, workflow logs the error but doesn't crash
13. ✅ Lead with only phone (SMS source) gets an SMS instead of email
14. ✅ Lead with neither email nor phone returns early without sending

## Testing approach

For Claude Code's local testing:

1. Stub agent in DB manually (one row in `agents`)
2. Hit webhook with curl using example payloads (provide 6: 3 EN, 3 ES, of varying quality)
3. Observe logs in real time
4. Verify DB state after each call
5. Check actual email arrival in Resend dashboard

Example test payload (Tally):
```json
{
  "data": {
    "fields": [
      {"key": "name", "value": "Marcus Johnson"},
      {"key": "email", "value": "marcus@example.com"},
      {"key": "phone", "value": "+13051234567"},
      {"key": "budget", "value": "$800K"},
      {"key": "neighborhood", "value": "Coral Gables"},
      {"key": "reason", "value": "Looking to upgrade from a townhouse to a single family home, growing family"}
    ]
  }
}
```

Spanish equivalent:
```json
{
  "data": {
    "fields": [
      {"key": "name", "value": "Carolina Pérez"},
      {"key": "email", "value": "carolina@ejemplo.com"},
      {"key": "phone", "value": "+13057654321"},
      {"key": "budget", "value": "$600K"},
      {"key": "neighborhood", "value": "Doral"},
      {"key": "reason", "value": "Estoy buscando mi primera casa, recién casada y queremos formar familia"}
    ]
  }
}
```

## CTO review checklist

Before requesting CTO review, confirm:

- [ ] All 14 acceptance criteria pass
- [ ] Code follows conventions in CLAUDE.md
- [ ] No `any` types
- [ ] No raw SQL
- [ ] All AI prompts are in `lib/prompts/` not inline
- [ ] All external calls wrapped in `step()`
- [ ] `workflow_runs` populated correctly
- [ ] Unit tests OR manual test log included in PR
- [ ] PROGRESS.md updated
