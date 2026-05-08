# Page Spec: Lead Detail

**Goal:** Where the agent sees everything about a lead and takes action. Drafts review, conversation history, status changes.

**Route:** `/leads/[id]`  
**Layout:** Sidebar + main content. Main has 2 columns on desktop: left = conversation, right = lead context.  
**Primary user goal:** Read the latest reply + send AI draft (or edit) in <30 seconds.

## Layout (desktop)

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ Sidebar  │ Header                                                  │
│          │ ┌─────────────────────────────────────────────────────┐ │
│          │ │ ← Back to Inbox    Marcus Johnson       [⏸ Pause]   │ │
│          │ │ 🔥 Hot · Coral Gables · $800K · marcus@example.com  │ │
│          │ └─────────────────────────────────────────────────────┘ │
│          │                                                         │
│          │ ┌─────────────────────────┬─────────────────────────┐   │
│          │ │ Conversation            │ Context                 │   │
│          │ │                         │                         │   │
│          │ │ [Message bubble]        │ AI Score                │   │
│          │ │   Day 1 follow-up       │ 🔥 Hot                  │   │
│          │ │   2 days ago            │ Reasoning: Specific...  │   │
│          │ │                         │                         │   │
│          │ │ [Inbound message]       │ Suggested action        │   │
│          │ │   "Yes, looking..."     │ Call within 24 hours    │   │
│          │ │   1 hour ago            │                         │   │
│          │ │                         │ Lead Info               │   │
│          │ │ ┌───────────────────┐   │ Email: marcus@...       │   │
│          │ │ │ 📝 Draft ready    │   │ Phone: +1 305...        │   │
│          │ │ │ [editable text]   │   │ Source: Tally           │   │
│          │ │ │ [Send] [Discard]  │   │ Created: 2 days ago     │   │
│          │ │ └───────────────────┘   │ Language: English       │   │
│          │ │                         │                         │   │
│          │ │ [Type a message...]     │ Actions                 │   │
│          │ │ [Email|SMS] [Send]      │ [Mark as Won]           │   │
│          │ │                         │ [Mark as Lost]          │   │
│          │ │                         │                         │   │
│          │ └─────────────────────────┴─────────────────────────┘   │
└──────────┴─────────────────────────────────────────────────────────┘
```

## Header

- Back link to `/inbox`
- Lead name (large, bold)
- Score badge (🔥 Hot / 🌡 Warm / ❄️ Cold)
- Quick stats row: neighborhood, budget, email
- Pause toggle button (top-right): "Pause follow-ups" / "Resume follow-ups"
  - Updates `leads.paused`
  - When paused, badge shows "Paused"

## Left column: Conversation

### Message timeline
- Reverse chronological (newest at bottom, like a chat)
- Each message rendered as a bubble:
  - Outbound (us → lead): right-aligned, emerald background
  - Inbound (lead → us): left-aligned, gray background
- Each bubble shows:
  - Channel icon (✉️ email or 💬 SMS)
  - Subject (if email, in bold above body)
  - Body (rendered, line breaks preserved)
  - Footer: "AI-generated · {time ago}" or "Sent · {time ago}" or "Received · {time ago}"
- Auto-scroll to bottom on initial load
- Newer messages auto-load when they arrive (same 30s polling as inbox)

### Draft card (when there's a pending draft)
- Distinct visual treatment: emerald border, "📝 AI Draft" label
- Subject field (editable, only for emails)
- Body field (editable textarea)
- Footer:
  - **"Send"** button (primary, emerald) — sends via Resend or Twilio depending on channel
  - **"Discard"** button (ghost, gray) — sets message status to 'discarded'
  - **"Reasoning"** info tooltip — shows AI's reasoning for this draft

### Manual reply (always available, below timeline)
- Text area: "Type a message..."
- Channel selector if lead has both email and phone: radio buttons "Email" / "SMS"
- Send button
- This creates a `messages` row with `direction='outbound'`, `aiGenerated=false`, `status='sent'`, sends via the selected channel.

## Right column: Context

### AI Score card
- Score badge (large)
- Reasoning text (1-2 sentences)
- "Suggested action" text

### Lead Info card
- Email
- Phone (click-to-call: `tel:` link)
- Source
- Created date
- Last contact date
- Detected language
- Follow-up stage (e.g., "Day 3 sent", "Sequence completed")

### Actions card
- "Mark as Won" → sets `status='won'`, stops follow-ups
- "Mark as Lost" → sets `status='lost'`, stops follow-ups
- "Mark as Scheduled" → sets `status='scheduled'`
- "Delete lead" → confirmation dialog, then deletes (cascade messages)

## Mobile layout

On mobile (<768px), columns stack:
1. Header
2. Right column (Context) collapsed by default in a `<Accordion>`
3. Left column (Conversation) takes full width

The conversation is the primary action target on mobile.

## Click-to-call and click-to-email

- Phone number renders as `<a href="tel:+13051234567">`
- Email renders as `<a href="mailto:marcus@example.com">`
- Clicking these on mobile launches the phone / email app
- Don't try to handle calls in-app (no Twilio Voice client in V1)

## Auto-save notes (V2 deferred)

V1: no notes section. Agent's communication IS the record.

V2: add a notes textarea that auto-saves with debounce. Skip in V1.

## States

### Loading
- Skeleton: header skeleton, 3-4 message bubble skeletons, context skeletons
- Don't show empty states while loading

### Lead not found
- Title: "Lead not found"
- Body: "This lead might have been deleted or you don't have access."
- Button: "Back to Inbox"

### Lead deleted while viewing
- Toast: "This lead was deleted"
- Auto-redirect to Inbox after 2 seconds

### Draft being sent
- Send button shows spinner, disables
- On success: draft message updates to 'sent' status, bubble re-renders, toast "Sent ✓"
- On failure: toast with error, draft remains editable

## Real-time

Same 30s polling as Inbox. New messages appear without refresh.

## Acceptance criteria

1. ✅ Loads lead by ID from URL
2. ✅ Shows full conversation history in correct order
3. ✅ Draft messages clearly distinguished from sent messages
4. ✅ Drafts can be edited, sent, or discarded
5. ✅ Sending a draft actually sends via Resend/Twilio
6. ✅ Manual reply works for both email and SMS
7. ✅ Click-to-call and click-to-email work on mobile
8. ✅ Pause/resume toggles `leads.paused` and visible in UI
9. ✅ Status actions (Won/Lost/Scheduled/Delete) work and persist
10. ✅ Lead context shows AI score, reasoning, suggested action
11. ✅ Mobile layout stacks correctly
12. ✅ 404 state for invalid lead ID
13. ✅ Multi-tenant safe (can't view other agents' leads even with direct URL)
14. ✅ Auto-refresh every 30 seconds picks up new replies

## Testing approach

**Manual:**
1. Open a lead from inbox → view full thread
2. Approve a draft as-is → message sends, draft becomes 'sent'
3. Edit a draft → send → modified content delivered
4. Discard a draft → it disappears, history preserved
5. Send a manual reply → works
6. Pause → confirms in DB, badge updates
7. Mark as Won → status updates, follow-up workflow stops
8. Try to view lead by URL belonging to another agent → 404 or 403
9. Mobile: verify all interactions work

**Automated:**
- Component test for the draft card
- Component test for message bubble rendering
- E2E: navigate from inbox → lead detail → send draft → return to inbox → updated state

## CTO review checklist

- [ ] All 14 acceptance criteria pass
- [ ] Multi-tenancy bulletproof (try direct URL access)
- [ ] Real send actually goes out (test with Juan's own number/email)
- [ ] Mobile UX is good (real device test)
- [ ] No XSS in message rendering (sanitize HTML if any)
- [ ] No PII leaks in logs/Sentry
- [ ] PROGRESS.md updated
