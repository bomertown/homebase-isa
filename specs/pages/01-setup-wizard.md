# Page Spec: Setup Wizard

**Goal:** First-time onboarding flow that collects what we need to make Homebase work for the agent. Should feel quick, not bureaucratic.

**Route:** `/setup` (only accessible if `agent.onboardingCompleted === false`)  
**Layout:** Centered card, no sidebar, no nav (this is a focused flow)  
**Primary user goal:** Finish the wizard in <5 minutes.

## Flow overview

4 steps. Progress bar at top showing "Step X of 4."

1. **Personal Info** — name, phone, email (locked from Clerk), language preference
2. **Business Details** — market area, Calendly link
3. **Voicemail Recording** — record voicemail message in browser
4. **You're All Set** — confirmation, link to inbox

Skip is allowed on Step 3 only (voicemail). Steps 1, 2 require completion.

## Step 1: Personal Info

### Layout
- Card title: "Welcome to Homebase"
- Subtitle: "Let's get you set up. This takes about 3 minutes."
- Form fields (vertical stack):
  - **Name** — text input, required, prefilled from Clerk if available
  - **Phone** — phone input with US format mask, required, used for Twilio missed-call routing
  - **Email** — text input, disabled, prefilled from Clerk (locked, this is their login email)
  - **Language preference** — radio group: English / Español. Required. This is the language for their daily briefing.

- Primary button at bottom: "Continue →"
- No "Back" on Step 1 (nowhere to go back to)

### Validation
- Name: 2+ chars
- Phone: valid US phone (regex `^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$`), normalized to E.164 format on save
- Language: required selection

### Errors
- Inline below each field
- Use shadcn `<FormMessage>` pattern

### Behavior
- On submit: Server Action saves to `agents` table partial (don't mark onboardingCompleted yet)
- Success → router.push('/setup?step=2')

## Step 2: Business Details

### Layout
- Card title: "Tell us about your business"
- Form:
  - **Market area** — text input, required. Placeholder: "e.g., Coral Gables, Doral, Brickell"
  - **Calendly link** — URL input, required. Help text: "We'll share this with leads automatically. Don't have one? [Create one free at calendly.com →](https://calendly.com)"
  - **Tally form URL** — disabled input, prefilled with the agent's unique form URL (we generate this server-side). Help text: "Use this URL on your website, social media, or wherever you collect leads."

- Buttons: "← Back" + "Continue →"

### Validation
- Market area: 2+ chars
- Calendly URL: must match `^https://calendly.com/.+`
- Tally URL: read-only, no validation

### Behavior
- On submit: save to `agents`, generate `inboundEmailAlias` if not yet set (format: `{firstName}@inbox.{domain}`)
- → router.push('/setup?step=3')

## Step 3: Voicemail Recording

### Layout
- Card title: "Record your voicemail"
- Subtitle: "When a lead calls and you don't answer, we'll play this message."
- Help text below: "Recommended: 15-30 seconds. Mention your name and that you'll text back fast."
- Sample script in a quote block:
  > "Hi, you've reached [Your Name]. I'm probably with a client. Leave a message and I'll text you right back. Or book a time at the link I'll send you."

### Components
- Big circular Record button (red when armed, pulsing when recording, stops when clicked)
- Timer showing recording duration (max 60 seconds, auto-stop)
- After recording:
  - Audio preview player (HTML5 `<audio controls>`)
  - "Record again" button
  - "Save voicemail" button

### Tech notes
- Use browser MediaRecorder API
- Capture as `audio/webm` or `audio/mp4` depending on browser
- On save: upload to Cloudflare R2 via signed URL endpoint `/api/agents/voicemail/upload`
- Save resulting URL to `agents.voicemailUrl`
- Twilio compatibility: Twilio's `<Play>` accepts MP3 and WAV. Convert webm → MP3 server-side using FFmpeg in a Vercel Function before storing. (Or skip conversion if Twilio supports webm — verify in V1.)

### Skip option
- "Skip for now" link below the buttons. Saves agent state, advances to Step 4. Voicemail can be added later from Settings.

### Buttons
- "← Back" + ("Save & continue →" OR "Skip for now")

## Step 4: You're All Set

### Layout
- Big checkmark icon (Lucide `CheckCircle`)
- Title: "You're all set, {firstName}!"
- Body text in plain language:
  > "Homebase is now ready. Here's what happens next:
  > - Leads from your Tally form will be answered in <60 seconds
  > - You'll get a daily briefing at 8am
  > - Replies will appear in your inbox with AI-written drafts
  > 
  > Anything else, just check Settings."
- Primary button: "Go to my Inbox" → `/inbox`
- Secondary link: "Customize my settings" → `/settings`

### Behavior
- On render: Server Action sets `agents.onboardingCompleted = true`
- This is a one-way door — they can't return to setup once on Step 4

## Mobile responsive

The wizard MUST work well on mobile. Most agents will set up on their phone.

- Single column always (no multi-column even on desktop)
- Card takes 90% width on mobile, max 480px on desktop
- Buttons full-width on mobile
- Recording UI: bigger button on mobile, easier to tap

## States

### Loading
- Server Action submission shows button as disabled with spinner
- Use shadcn `<Button disabled>` with `<Loader2 className="animate-spin" />`

### Error
- Network errors: shadcn `<Alert variant="destructive">` at top of card
- Form errors: inline (covered above)
- Voicemail upload errors: alert above the Record button with retry option

### Empty
- Not really an empty state for a wizard, but if URL is `/setup?step=99` (invalid), redirect to `/setup`

## Accessibility

- All form fields have explicit labels
- Progress bar has `aria-label`
- Recording state announced via `aria-live` for screen readers
- Tab order: top to bottom, left to right
- Skip links work with keyboard

## Acceptance criteria

1. ✅ Wizard renders only when `onboardingCompleted=false`
2. ✅ Completed agents are redirected to `/inbox` if they hit `/setup`
3. ✅ All 4 steps navigable forward and backward (except Step 1 has no back)
4. ✅ Form data persists across steps even on browser refresh (use URL or session storage)
5. ✅ Required fields enforced; user can't proceed without filling
6. ✅ Phone number normalized to E.164 on save
7. ✅ Tally URL is generated and unique per agent
8. ✅ Inbound email alias is generated and unique per agent
9. ✅ Voicemail records, previews, and uploads to R2 successfully
10. ✅ Voicemail can be skipped
11. ✅ Step 4 marks `onboardingCompleted=true` and redirects to `/inbox`
12. ✅ Mobile layout works on iPhone Safari and Android Chrome (real device or DevTools)
13. ✅ Voicemail audio is playable by Twilio's `<Play>` TwiML

## Testing approach

**Manual on desktop and mobile:**
1. New agent signup → land on Step 1
2. Fill incrementally, verify validation
3. Refresh page mid-wizard → state preserved
4. Record voicemail → preview → save → URL appears in DB
5. Skip voicemail → confirm reaches Step 4
6. Complete → reach Inbox
7. Hit `/setup` again → redirected to Inbox

**Automated:**
- Component tests for each step's form validation
- E2E test with Playwright: full happy path

## CTO review checklist

- [ ] All 13 acceptance criteria pass
- [ ] Mobile UX tested on real device (or Juan's phone)
- [ ] Voicemail workflow tested end-to-end including Twilio playback
- [ ] All required fields are actually required
- [ ] No way to bypass the wizard via URL manipulation
- [ ] Both EN and ES language preference work in subsequent flows
- [ ] PROGRESS.md updated
