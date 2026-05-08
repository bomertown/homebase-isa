# Workflow Spec: Daily Briefing

**Goal:** Every morning at 8am (in agent's timezone), generate a concise AI-written briefing email summarizing what the agent should do today.

**Workflow file:** `workflows/daily-briefing.ts`  
**Trigger:** Vercel Cron — `0 8 * * *` adjusted per-agent timezone OR fan-out from a single cron  
**Estimated execution time:** 5-30 seconds per agent  
**Durability:** Yes — must not skip a day if AI fails

This is the most demonstrable AI feature in the product. It's what makes the agent feel like they have an assistant. Investing in prompt quality here pays the most.

## Trigger architecture

Vercel Cron fires once per timezone slot. For V1, simplification: cron fires every 30 minutes 24/7, the workflow loops over all agents and processes the ones whose local time is currently 8:00-8:29am.

Pseudocode:
```typescript
export async function dailyBriefingDispatcher() {
  'use workflow';
  const now = new Date();
  const allAgents = await step('fetch-agents', () => 
    db.select().from(agents).where(eq(agents.onboardingCompleted, true))
  );
  
  for (const agent of allAgents) {
    const localHour = getLocalHour(now, agent.timezone);
    if (localHour === 8) {
      // Spawn child workflow for this agent
      await step(`briefing-${agent.id}`, () => 
        generateBriefingForAgent({ agentId: agent.id })
      );
    }
  }
}
```

In V2 we'd switch to per-agent scheduled workflows, but for now this is fine for <50 agents.

## Inputs (per-agent)

```typescript
type DailyBriefingInput = {
  agentId: string;
}
```

## Outputs

```typescript
type DailyBriefingOutput = {
  briefingId: string;
  emailSent: boolean;
  hotLeadCount: number;
  newReplyCount: number;
}
```

## Steps (in order)

### Step 1: `fetch-agent`
Read agent from DB. Capture `name`, `email`, `preferredLanguage`, `timezone`.

### Step 2: `gather-data`
Pull data needed for the briefing in parallel where possible:

- **Hot leads:** `leads` where `agentId=X AND aiScore='hot' AND status NOT IN ('won', 'lost', 'opted_out', 'cold')`. Sort by `priority ASC`. Limit 10.

- **New replies in last 24h:** `messages` where `direction='inbound' AND createdAt > now()-24h`, joined to `leads` for that agent. Limit 10.

- **Leads with drafts waiting:** `messages` where `status='draft' AND createdAt > now()-3d` for that agent. Limit 5.

- **Leads going cold (5-7 days no contact):** `leads` where `agentId=X AND status='in_conversation' AND lastContactAt < now()-5d AND lastContactAt > now()-7d`. Limit 5.

- **Counts (for context):** total leads ever, leads this week, response rate this week.

### Step 3: `generate-briefing`
Call `generateBriefing()` from `lib/ai/generate-briefing.ts`. Use `generateText` (free-form prose, this is a narrative).

Use `gpt-4o-mini`. Prompt in `lib/prompts/briefing.ts`. Pass all gathered data + agent's `preferredLanguage`.

Prompt should produce:
- A 2-3 sentence opener that addresses the agent by name and sets the tone
- A "Top priorities today" section with 1-3 specific action items naming specific leads
- A "Replies needing attention" section if there are any
- A "Going cold" section if there are stale leads
- A "Stats" line (something concrete like "You responded to 80% of leads under 5 minutes this week — keep it up")
- A close ("That's it — go close some deals.") — should feel human, brief

Total length target: 150-250 words. Strict.

The prompt MUST forbid:
- Made-up statistics not in the data
- Comparisons to weeks/months we don't have data for
- Generic advice ("respond quickly to leads!") — only specific, lead-named action items
- Excessive emoji
- Greetings like "I hope you're well" (skip pleasantries, agent reads this in 30 seconds)

### Step 4: `save-briefing`
Insert into `briefings`:
- `agentId`, `date=today`, `language`, `summary=AIoutput`, `hotLeadIds`, `newRepliesCount`

### Step 5: `send-briefing-email`
Use React Email template `emails/briefing-{lang}.tsx`.

The email is structured (not just the AI text):
- Header with date and "Good morning, {agentName}"
- AI summary text rendered nicely
- A list of hot leads with avatars/names/budgets/links to the app
- A list of pending replies with names/preview/links
- Footer: link to inbox, link to settings (in case they want to disable briefings)

Send via Resend.

## Error handling

- **AI fails:** Fall back to a template-based briefing using the gathered data. Format: "Good morning, {name}. You have {N} hot leads needing attention today: {list}. {N} new replies are waiting." Better something than nothing.

- **Email fails:** Retry 3x. After failure, log to Sentry. The briefing is in DB; agent can view it on a future briefing page (V2).

- **No data to brief about (new agent, no leads yet):** Skip the email entirely. Don't send "you have no leads" — that's depressing and unhelpful. Just don't send. We'll start sending once they have ≥1 lead.

- **Multiple briefings same day:** The dispatcher loop should be idempotent. Add a check: if a briefing exists for this agent for today's date already, skip.

## Acceptance criteria

1. ✅ Cron runs every 30 minutes
2. ✅ Workflow correctly identifies which agents are at 8am local time
3. ✅ Data gathering query takes <2 seconds for an agent with 100 leads
4. ✅ Briefing is generated in agent's `preferredLanguage` (en or es)
5. ✅ Briefing names specific leads, not generic advice
6. ✅ Briefing length is 150-250 words
7. ✅ Briefing arrives by 8:30am agent local time
8. ✅ React Email template renders correctly in Gmail, Outlook, Apple Mail (test all 3)
9. ✅ Mobile-readable (most agents will read on phone)
10. ✅ Agent with no leads gets no email (not an empty briefing)
11. ✅ Idempotent: cron firing twice doesn't send 2 briefings
12. ✅ AI failure falls back to template briefing
13. ✅ `briefings` table has the record for audit/future briefing-history page

## Testing approach

**Manual test (Juan as canary):**
1. Set Juan up as an agent in production with ~5-10 fake leads of varying scores
2. Wait until 8am ET
3. Verify briefing arrives by 8:30am
4. Verify it correctly names the hot leads and replies
5. Repeat with `preferredLanguage='es'` to test Spanish briefing

**Automated testing:**
- Unit tests for the data-gathering queries (with seeded DB)
- Snapshot tests for the React Email template rendering
- Mock the AI call for prompt unit tests (verify prompt contains expected fields)

**Edge cases to verify manually:**
- Agent with 0 leads: no email sent
- Agent with 1 lead: brief but coherent briefing
- Agent with 100 leads: still 150-250 words, focuses on top priorities
- Spanish-preferring agent: 100% Spanish output, no mixed language

## CTO review checklist

- [ ] All 13 acceptance criteria pass
- [ ] Briefing prompt reviewed by CTO (this is the most user-visible AI output)
- [ ] Both EN and ES briefings tested with real fake data
- [ ] React Email templates tested in 3 email clients
- [ ] Cron timing logic handles DST changes (test by faking timezone offsets)
- [ ] Cost per briefing logged in `workflow_runs.metadata` (should be <$0.01)
- [ ] No spam-trigger words in subject/body (test with mail-tester.com)
- [ ] PROGRESS.md updated
