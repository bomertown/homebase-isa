# Page Spec: Settings

**Goal:** Single page where the agent updates everything about themselves and their setup. Section-based, no sub-routing.

**Route:** `/settings`  
**Layout:** Sidebar + main content (single column, sectioned)  
**Primary user goal:** Find and change one specific setting in <30 seconds.

## Layout

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Settings                                     │
│          │                                              │
│          │ ── Profile ──────────────────────────────    │
│          │ Name, Phone, Photo (V2)                      │
│          │ [Save]                                       │
│          │                                              │
│          │ ── Preferences ──────────────────────────    │
│          │ Language, Timezone                           │
│          │ [Save]                                       │
│          │                                              │
│          │ ── Forms & Links ────────────────────────    │
│          │ Tally URL (read-only, copy)                  │
│          │ Email alias (read-only, copy)                │
│          │ Calendly URL (editable)                      │
│          │ [Save]                                       │
│          │                                              │
│          │ ── Voicemail ────────────────────────────    │
│          │ Current recording or "No voicemail set"      │
│          │ [Record new] / [Delete]                      │
│          │                                              │
│          │ ── Account ──────────────────────────────    │
│          │ Email (locked), Sign out, Danger zone        │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

Sections separated by horizontal lines and clear headers. Each section's "Save" button only saves that section's fields.

## Section: Profile

### Fields
- **Name** (editable)
- **Phone** (editable, validated as US phone, normalized to E.164)
- **Photo** — V2, skip for V1. Show a placeholder avatar.

### Save behavior
- Server Action updates `agents` table partial
- Toast on success: "Profile updated"
- Toast on error: "Failed to save. Try again."

## Section: Preferences

### Fields
- **Language** — radio: English / Español. Help text: "Language for your daily briefings and notifications."
- **Timezone** — dropdown of common US timezones (default America/New_York)
  - Help text: "Daily briefing arrives at 8am in this timezone."
  - Use the IANA timezone names (`America/New_York`, `America/Los_Angeles`, etc.)

## Section: Forms & Links

### Tally URL
- Read-only text showing the agent's unique Tally form URL
- Copy button next to it
- Help text: "Add this URL to your website, social media, or email signature."
- Optional: open in new tab button

### Inbound Email Alias
- Read-only text showing `juan@inbox.homebase.app` (or whatever alias)
- Copy button
- Help text: "Forward leads from any source to this address. We'll process them automatically."

### Calendly URL
- Editable input
- Validation: must match `^https://calendly.com/.+`
- Help text: "We'll share this link with leads automatically when scheduling comes up."
- Save button for this field

## Section: Voicemail

### When agent has a voicemail
- Audio player with the current recording
- Recorded date/time
- "Record new" button (opens the same recording UI as setup wizard)
- "Delete" button (with confirmation: "Leads who call when you don't answer will hear silence then a hang-up. Continue?")

### When agent has no voicemail
- Empty state: "You haven't recorded a voicemail yet."
- Help text: "When leads call and you don't answer, we'll play this message before sending them a text."
- "Record voicemail" button → opens recording UI

### Recording UI (same as setup wizard step 3)
- Modal or inline section
- MediaRecorder, preview, save flow
- Updates `agents.voicemailUrl`

## Section: Account

### Email (locked)
- Display Clerk email
- Help text: "This is your login email. To change it, contact support."

### Sign out button
- Button: "Sign out"
- Calls Clerk's sign-out method
- Redirects to `/login`

### Danger zone
- Header: "Danger zone" (red text)
- "Delete my account" button (red outline)
- Confirmation dialog: typed confirmation ("DELETE") to enable button
- Deletes agent + cascades all leads and messages
- Signs out and redirects to landing page
- Help text: "This permanently deletes everything. We can't restore it."

## States

### Loading
- Show skeleton sections while initial agent data loads
- Each section's save button shows spinner during submit

### Save success/failure
- Toast notifications for all save actions
- No alerts, no inline messages (except for validation errors)

### Validation errors
- Inline below the field
- Red text using shadcn FormMessage

### Permission errors
- Should never happen (settings are own-data only) but: 401 redirect to login

## Mobile responsive

- Single column (already)
- Sidebar collapses to sheet
- All inputs full-width
- Sections expand by default; could add collapse-by-default for mobile if list gets long (V2)

## Acceptance criteria

1. ✅ All 5 sections render with correct current values
2. ✅ Profile section saves name and phone successfully
3. ✅ Preferences section saves language and timezone successfully
4. ✅ Calendly URL validates and saves
5. ✅ Tally URL is read-only and has working copy button
6. ✅ Inbound email alias is read-only and has working copy button
7. ✅ Voicemail records, uploads, and saves URL
8. ✅ Voicemail can be deleted (clears `voicemailUrl`)
9. ✅ Voicemail audio plays back via the player
10. ✅ Sign out works and redirects to login
11. ✅ Account deletion has typed confirmation
12. ✅ Account deletion cascades all data
13. ✅ Toast notifications appear for all save actions
14. ✅ Mobile layout works
15. ✅ Multi-tenant safe — agent only sees and edits own data
16. ✅ Language change reflects immediately in next briefing
17. ✅ Timezone change reflects in next briefing schedule

## Testing approach

**Manual:**
1. Change name → save → reload → persisted
2. Change language EN → ES → save → next briefing comes in Spanish
3. Change timezone → verify briefing time shifts
4. Update Calendly URL → save → next AI email uses new URL
5. Try invalid Calendly URL → validation error
6. Copy Tally URL → paste somewhere → URL is correct
7. Record new voicemail → save → call Twilio number → hear new voicemail
8. Delete voicemail → call Twilio number → silence/hang-up
9. Delete account → all DB rows for this agent gone
10. Mobile: all flows work

**Automated:**
- Server Action tests for each save
- Validation tests for inputs
- E2E for happy path

## CTO review checklist

- [ ] All 17 acceptance criteria pass
- [ ] Voicemail end-to-end works (record → upload → Twilio plays)
- [ ] Timezone affects actual workflow scheduling
- [ ] Language affects actual AI prompts
- [ ] Account deletion truly cascades (verify no orphan rows)
- [ ] Sign out clears session properly
- [ ] PROGRESS.md updated
