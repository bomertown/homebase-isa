# Page Spec: Inbox (Unified)

**Goal:** The agent's home base. They open this every day to see who needs attention, and act on it fast.

**Route:** `/inbox` (also the post-login landing for completed-onboarding agents)  
**Layout:** Sidebar + main content (this is the start of the dashboard layout)  
**Primary user goal:** Identify hottest lead in <5 seconds. Open it in 1 click.

## Layout

```
┌──────────┬─────────────────────────────────────────────────┐
│ Sidebar  │ Main: Inbox                                      │
│          │                                                  │
│ Logo     │ ┌────────────────────────────────────────────┐   │
│          │ │ [Search bar] [Filter chips]                │   │
│ Inbox    │ └────────────────────────────────────────────┘   │
│ Settings │                                                  │
│          │ ┌── Lead row ─────────────────────────────────┐  │
│          │ │ 🔥 Marcus Johnson · Coral Gables · $800K     │  │
│          │ │ "Hi, looking for a 4BR..." · 2 min ago       │  │
│          │ └─────────────────────────────────────────────┘  │
│          │                                                  │
│          │ ┌── Lead row ─────────────────────────────────┐  │
│          │ │ 💬 Carolina Pérez · Doral · $600K (1 reply)  │  │
│          │ │ "¿Tienen casas con piscina?" · 1 hour ago    │  │
│          │ └─────────────────────────────────────────────┘  │
│          │                                                  │
│ Avatar   │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

## Sidebar (shared across dashboard pages)

- Width: 240px on desktop, collapsible to icon-only on smaller screens
- Top: Homebase logo
- Nav items:
  - Inbox (active when on `/inbox`)
  - Settings (active on `/settings`)
- Bottom: User avatar + name (click → Clerk's UserButton menu with sign out)

Use shadcn's sidebar primitives if available, else build with Tailwind.

## Top bar (above lead list)

### Search
- Full-text search across lead name, email, phone, notes, message content
- Implementation: Postgres full-text search with `tsvector` columns OR simpler `ILIKE %query%` on key fields for V1. ILIKE is fine for first 1000 leads.
- Debounced 300ms
- Clears on Escape

### Filter chips (toggleable)
- "All" (default)
- "🔥 Hot" — `aiScore = 'hot'`
- "💬 Replied" — `repliedAt IS NOT NULL`
- "📝 Drafts" — leads with `status='draft'` messages
- "❄️ Cold" — `status = 'cold' OR followUpStage >= 7 AND repliedAt IS NULL`
- "🚫 Opted out" — `status = 'opted_out'`

Multiple chips can be active. ANDed.

### Sort dropdown
- Default: Priority (lowest priority number = top)
- Alternatives: Newest first, Oldest first, A-Z

## Lead row component

Each row:
- **Left:** Status icon + score icon + lead name (bold) + secondary info (neighborhood, budget) in muted text
- **Middle:** Last message preview (truncated to ~60 chars, with `...`)
- **Right:** Relative timestamp ("2 min ago", "1 hour ago", "3 days ago")
- **Hover:** Background changes to `neutral-50`
- **Click:** Navigates to `/leads/{id}`

### Visual details
- Hot leads have a small flame `🔥` in front of the name
- Leads with new replies have a `💬` indicator
- Leads with pending drafts have `📝`
- Cold leads are slightly desaturated (gray text)
- Opted-out leads show as struck-through

### Status badges (right side, optional)
- "New" — gray
- "Contacted" — blue
- "In conversation" — amber
- "Scheduled" — purple
- "Cold" — gray (light)

Use shadcn `<Badge>` with variants.

## Empty states

### No leads at all (new agent)
- Icon: Inbox (Lucide)
- Title: "Nothing here yet"
- Body: "When leads come in, they'll appear here. Share your Tally form link to get started."
- Primary action: "Copy my Tally link" button → copies to clipboard, shows toast

### No leads matching filter
- Icon: SearchX (Lucide)
- Title: "No leads match these filters"
- Body: "Try removing a filter or searching for something else."
- Action: "Clear filters" button

## Pagination / virtualization

- For V1, load all leads (no pagination). Cap at 500 max — if more, paginate via cursor.
- Use Next.js Server Components for the initial render — fast.
- For 100+ leads, use `react-virtual` or similar for the list virtualization to keep scroll smooth.

## Real-time updates (V1: optional, V2: required)

For V1, polling is fine: refresh the page or have it auto-refresh every 30 seconds.

For V2 we'd add Server-Sent Events or websockets so new leads appear instantly without refresh.

V1 implementation: `<RefreshOnInterval interval={30000} />` Client Component that calls `router.refresh()`.

## Mobile responsive

- Sidebar collapses to a hamburger that opens a sheet (shadcn Sheet)
- Lead rows stack vertically, font smaller
- Filter chips horizontal scroll
- Search bar full-width
- Tap target on each row at least 44px tall

## States

### Loading
- Skeleton rows (shadcn Skeleton) — 5 rows
- Sidebar renders immediately (it's static)

### Error
- Toast notification with retry button
- Don't block the page; degrade gracefully

## Performance targets

- Initial load (Server Component): <500ms TTFB
- Search response: <100ms after debounce
- Filter change: instant (client-side)

## Acceptance criteria

1. ✅ Lists all leads for the logged-in agent (sorted by priority)
2. ✅ Search filters across name, email, phone, message content
3. ✅ Filter chips work individually and combined
4. ✅ Sort dropdown works
5. ✅ Hot leads visually distinguishable
6. ✅ Leads with new replies indicated
7. ✅ Click on lead navigates to `/leads/{id}`
8. ✅ Empty state for new agent shows Tally link
9. ✅ Empty state for filtered-out leads shows clear-filter option
10. ✅ Mobile layout works with sidebar sheet
11. ✅ Auto-refresh every 30 seconds
12. ✅ Multi-tenant safe (other agents' leads never visible)
13. ✅ Loading skeleton on initial render
14. ✅ Page TTFB under 500ms with 100 leads in DB

## Testing approach

**Manual:**
1. Login → land on inbox
2. Verify all leads visible
3. Try each filter individually
4. Try combinations
5. Search for partial name → results filter
6. Click a lead → goes to detail
7. Test on mobile viewport
8. Login as second agent (test data) → only see their leads

**Automated:**
- Component tests for filter logic, sort logic
- E2E test: login → inbox → search → click lead

## CTO review checklist

- [ ] All 14 acceptance criteria pass
- [ ] Multi-tenancy verified (critical: never show another agent's data)
- [ ] Search performance acceptable with 100+ leads
- [ ] Mobile UX tested
- [ ] Empty states tested by deleting all leads in test DB
- [ ] No N+1 queries (check the SQL log)
- [ ] PROGRESS.md updated
