---
title: Personal OS — Design Spec
date: 2026-05-21
owner: Max Allaire
status: Draft pending review
---

# Personal OS — Design Spec

> ⚠ **PLATFORM DIRECTION UPDATE — 2026-06-08.** This spec describes the **Phase-1 web/PWA product**,
> which is **live in production and remains the source of truth**. As of 2026-06-08 the platform
> direction **expanded to a second surface: a full native iOS mobile app** (React Native + Swift),
> which becomes the primary mobile surface and carries the planned integrations. See the dedicated
> direction doc: **`2026-06-08-personal-os-native-mobile-app-design.md`**. Consequences for *this*
> document: the "native iOS app" non-goal in §1.3 is **reversed** (now committed), the Health Auto
> Export integration in §6.5 is **deprecated** (replaced by native HealthKit), and the Phase-3
> "iOS-native app" line in §7 is **promoted from stretch to committed**. Inline ⚠ notes mark each.

## 0. Context

**Personal OS** (internal codename: Max OS) is a personal operating system for one user — finances, health, training, calendar, social, journal, inbox, and a Telegram-fed agent that triages everything. It is the source of truth for Max's life.

**Design provenance.** A complete visual design exists at `design_handoff_personal_os/` (README + reference image + JSX/HTML prototype). The visual system, copy, and module list are settled — the prototype is design reference, not shippable code. This spec covers what to build, in what order, with what tradeoffs.

**Critical context about the operator.** Max does not read or write code. He directs work, evaluates by outcomes (not by code review), and tends to idea-hop between threads. Personal OS itself is the active committed thread for this project. Build discipline: ship-when-end-to-end-works per slice; do not start a new module/integration until the current one is fully working.

---

## 1. Goals & Success Criteria

### 1.1 Goal

Personal OS is Max's daily-driver tool — one place to log, view, and reason about every relevant data stream in his life — built as a Next.js PWA installable on iPhone home screen. Phase 1 ships a complete visual product with all 12 dashboard modules, 5 secondary pages, real data integrations (Plaid, Google Calendar, Gmail, Whoop, Health Auto Export), and full manual entry. Agent is Phase 2.

### 1.2 Success Criteria (priority order)

1. **Daily usage** — Max opens the app and/or interacts with it at least once per day for two consecutive weeks after launch
2. **Source-of-truth accuracy** — Integration data is fresh and correct; ≥99% sync success rate per integration over rolling 7-day window
3. **Visual fidelity** — All design tokens from `app.css`/`hearth.css` match. Acceptance checklist in `design_handoff_personal_os/README.md:449-467` passes
4. **Performance** — Dashboard LCP <2s on desktop; mobile interactions feel native (tap-to-response <100ms)
5. **PWA install works** — Installable on iPhone Safari → home screen → standalone mode with proper splash and manifest
6. **No scope drift** — Phase 1 ships with the agreed module set. If anything threatens delivery, scope gets cut before quality cuts.

### 1.3 Non-Goals (Phase 1 explicit cuts)

- Multi-user, sharing, invites (data model is multi-tenant-ready; only one user enabled)
- Structured agent memory ("facts about Max" long-term store) — defer to Phase 3
- ~~Native iOS app, App Store presence~~ — ⚠ **REVERSED 2026-06-08:** a full native iOS app (React Native + Swift) is now committed as the primary mobile surface. See `2026-06-08-personal-os-native-mobile-app-design.md`.
- Search / command palette (⌘K chip stays decorative)
- Real Cream and Warm themes (token system in place, values filled in Phase 3)
- Integrations beyond the agreed five (Coinbase, GitHub social, X, LinkedIn, Substack, IG, training-app APIs)
- Email writing/triage from inside Personal OS (Inbox tile is read-only)
- Voice messages on Telegram (Whisper transcription) — Phase 3
- Long-running agent workflows (Vercel Workflow integration) — Phase 3+

---

## 2. Architecture

### 2.1 Stack

| Layer | Choice |
|---|---|
| App framework | Next.js 14+ App Router, TypeScript strict mode |
| Styling | Tailwind CSS with design tokens lifted from `app.css` into Tailwind theme + CSS variables on `:root`/`[data-theme=*]` |
| UI primitives | shadcn/ui (Dialog, DropdownMenu, Tooltip, Toast/Sonner, ScrollArea, Tabs, Sheet, Popover) |
| Custom components | Card, TopBar, Sparkline, SessionCard, AgentPanel, HabitGrid, CalendarStrip, CaptureBar (match design exactly) |
| Data | Supabase: Postgres + Auth (magic-link) + Realtime + Storage |
| Client state / cache | SWR for client-side cache + revalidate-on-focus |
| Mutations | Next.js Server Actions |
| Realtime | Supabase Realtime subscriptions |
| LLM (Phase 2) | Vercel AI SDK + Anthropic provider + Claude Sonnet 4.6 with prompt caching |
| Validation | Zod at every boundary (server actions, webhook payloads, agent tool args) |
| Hosting | Vercel (Functions + Edge where it helps) |
| Tests | Vitest (unit + integration) + Playwright (E2E) |
| Migrations | Supabase CLI generates SQL diffs, applied via `supabase db push` in CI |

### 2.2 Runtime Topology

```
                ┌───────────────────────────────┐
                │   iPhone Safari / Desktop      │
                │   (PWA, Next.js App Router)    │
                └────────────┬──────────────────┘
                             │
              Server Actions │ Supabase Realtime (SSE)
                             │
                             ▼
                ┌───────────────────────────────┐
                │   Next.js on Vercel            │
                │                                │
                │  Route handlers:               │
                │    /api/telegram/webhook       │  (Phase 2)
                │    /api/plaid/webhook          │
                │    /api/whoop/webhook          │
                │    /api/gmail/sync             │  (cron)
                │    /api/google-calendar/sync   │  (cron)
                │    /api/health-export          │  (HAE → us)
                │    /api/agent/turn             │  (Phase 2)
                │                                │
                │  Server actions:               │
                │    addTask, logHabit, ...      │
                │    (consumed by UI + agent)    │
                └───────────────┬────────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │   Supabase (Postgres + Auth   │
                │   + Realtime + Storage)        │
                └───────────────────────────────┘
                                ▲
                                │ (Phase 2)
                ┌───────────────┴───────────────┐
                │   Telegram Bot API webhook    │
                └───────────────────────────────┘
```

### 2.3 Key Architectural Decisions

- **Single write path.** Every mutation (UI form submit, agent tool call in Phase 2, integration webhook) flows through the same Zod-validated, RLS-protected Server Action. No bypass paths. This is the single most important architectural choice in this spec.
- **Source column on every module table.** `source: 'manual' | 'plaid' | 'whoop' | 'apple_health' | 'google_calendar' | 'gmail' | 'agent'`. Source priority resolves conflicts at read time (e.g., for sleep score: whoop > apple_health > manual).
- **Realtime updates via Supabase subscriptions.** No bespoke WebSocket plumbing. When an integration webhook writes a row, subscribed UI clients re-render within ~200ms.
- **Cron over webhooks for Calendar and Gmail.** Simpler, no channel-renewal cycle, 5-10 min latency invisible for personal use.
- **No separate agent service in Phase 2.** Agent runtime is a Vercel Function returning within ~3-10s. No queues, no workflows, no durable execution. If long-running agent jobs become needed (Phase 3+), add Vercel Workflow then.
- **Layout switching via client matchMedia, not user-agent sniffing.** Web 3-zone and mobile single-column are materially different IA — we switch shells, not just CSS.

---

## 3. Data Model

### 3.1 Tables (14 total)

All tables have a `user_id uuid not null` column and an RLS policy `using (auth.uid() = user_id)`. Single user enabled today; the data model is multi-tenant-ready.

**Identity, integrations, agent (3 tables):**

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Operator card data | `id` (FK to auth.users), `name`, `initials`, `role`, `location`, `focus`, `streak`, `timezone`, `theme` (`'dark'|'cream'|'warm'`) |
| `integrations` | Connection state per provider | `id`, `user_id`, `provider`, `status` (`'connected'|'expired'|'error'`), `access_token` (encrypted via pgcrypto), `refresh_token`, `last_synced_at`, `last_error`, `metadata` jsonb |
| `agent_messages` | Conversation log across all channels (Phase 2 active; table exists in Phase 1A) | `id`, `user_id`, `role` (`'you'|'agent'`), `source` (`'TELEGRAM'|'WEB_CAPTURE'|'MOBILE_CAPTURE'|'MAX_OS'`), `text`, `chips` jsonb, `tool_calls` jsonb, `created_at` |

**Module tables (11 tables):**

| Module | Table(s) | Key columns |
|---|---|---|
| Tasks | `tasks` | `title`, `tags` text[], `star` bool, `done` bool, `priority`, `due_at`, `created_at` |
| Habits | `habits` | `name`, `sub_label`, `archived` bool, `position` |
| Habits | `habit_logs` | `habit_id` (FK), `date`, `done` bool — one row per habit per day |
| Calendar | `calendar_events` | `title`, `sub`, `location`, `starts_at`, `ends_at`, `external_id` (Google event id), `source` |
| Finance | `finance_accounts` | `name`, `type` (`'BANK'|'HYSA'|'EQUITY'|'RETIRE'|'CRYPTO'|'PRIVATE'|'T_BILLS'`), `current_value`, `plaid_account_id`, `source` |
| Finance | `finance_snapshots` | `account_id` (FK), `date`, `value` — one row per account per day for sparkline |
| Nutrition | `nutrition_entries` | `description`, `kcal`, `protein_g`, `carbs_g`, `fat_g`, `eaten_at`, `source` |
| Health | `health_snapshots` | `date`, `sleep_score`, `sleep_hours`, `recovery_score`, `strain`, `hrv`, `rhr`, `weight`, `weight_unit`, `steps`, `vo2_max`, `source` — one row per day (latest per metric by source priority) |
| Social | `social_followers` | `platform` (`'X'|'LINKEDIN'|'SUBSTACK'|'GITHUB'|'IG'`), `date`, `count` |
| Training | `training_sessions` | `started_at`, `split_name`, `notes` |
| Training | `lifts` | `session_id` (FK), `name`, `weight`, `weight_unit`, `reps`, `sets`, `is_pr` bool |
| Journal | `journal_entries` | `text`, `tags` text[], `mentions` jsonb, `written_at` |
| Inbox | `gmail_threads` | `gmail_id` unique, `sender_name`, `sender_email`, `subject`, `snippet`, `received_at`, `is_unread`, `is_important`, `labels` text[] |

**Observability (2 tables):**

| Table | Purpose |
|---|---|
| `sync_runs` | Per-integration sync log: `provider`, `started_at`, `finished_at`, `rows_synced`, `status` (`'ok'|'partial'|'failed'`), `error_message` |
| `error_events` | Server action exceptions: `provider`, `severity` (`'info'|'warn'|'error'`), `message`, `context` jsonb |

### 3.2 Design Patterns

- **Time-series tables** (`finance_snapshots`, `health_snapshots`, `social_followers`, `habit_logs`) use a uniform shape: `(user_id, scope_id, date, value)`. Sparklines query last 30 days; secondary pages query 8-26 weeks.
- **Aggregations at read time, not write time.** Daily kcal totals are `sum(kcal)` queries. Streaks are window functions over `habit_logs`. Net worth is `sum(finance_accounts.current_value)`. Keeps writes simple, makes aggregation logic changeable without backfills.
- **No soft deletes in Phase 1.** Hard deletes. Add `deleted_at` only if a real regret emerges.
- **Composite indexes**: `(user_id, date)` on every time-series table; `(user_id, done)` on tasks; `(user_id, created_at desc)` on `agent_messages`; `(user_id, received_at desc)` on `gmail_threads`.

### 3.3 Source-Priority Resolution

For metrics where multiple sources can write to the same `(user_id, date)` row:

| Metric | Priority order |
|---|---|
| Sleep score | whoop > apple_health > manual |
| HRV | whoop > apple_health > manual |
| RHR | whoop > apple_health > manual |
| Weight | apple_health > manual |
| Steps | apple_health > manual |
| Recovery / Strain | whoop only |

Resolution happens at write time via upsert on `(user_id, date, metric)`: a write with lower priority is dropped if a higher-priority row already exists; a write with higher priority overwrites. Reads simply return whatever survived — no resolution logic on the read path.

---

## 4. Agent Design (Phase 2)

The agent is deferred to Phase 2. The schema (`agent_messages`) exists from Phase 1A so no migration is needed when the agent lands. This section is a forward-looking spec.

### 4.1 Channels

| Channel | Trigger | Source tag |
|---|---|---|
| Telegram | `/api/telegram/webhook` | `'TELEGRAM'` |
| Web capture bar (Session card) | Server action `submitCapture()` | `'WEB_CAPTURE'` |
| Mobile capture bar (top of Home) | Same server action | `'MOBILE_CAPTURE'` |

All three write to the same `agent_messages` table → one conversation thread, three channels.

### 4.2 Model & Context Strategy

- **Model**: Claude Sonnet 4.6 via Vercel AI SDK + Anthropic provider (re-verify current model lineup at Phase 2 implementation time; model IDs evolve)
- **Context per turn**: system prompt (cached) + state digest (cached, refreshed daily) + last 50 messages from `agent_messages`
- **Prompt caching**: cache breakpoints on system prompt + tool catalog + state digest. After first turn, cached content costs ~10% of fresh input
- **State digest**: ~500-1500 tokens summarizing current state (today's tasks, habits done/not, last weight, current focus, net worth, today's calendar). Built fresh each agent invocation
- **Growth strategy**: when `agent_messages` for user exceeds 50 messages in current window, older messages compressed into rolling summary attached to system prompt. Phase 1A ships with naive cutoff; rolling summary added if it becomes a problem

### 4.3 Tool Catalog

~30 typed tools, each backed by an existing Phase 1 server action (one write path):

| Module | Tools |
|---|---|
| Operator | `setFocus`, `setLocation` |
| Tasks | `addTask`, `markTaskDone`, `listTasks` |
| Habits | `addHabit`, `logHabit`, `removeHabit`, `listHabits` |
| Calendar | `addCalendarEvent`, `listEvents`, `cancelEvent` |
| Finance | `addAccount`, `updateAccountValue`, `listAccounts` |
| Nutrition | `logMeal` (LLM-estimates kcal/macros from text), `correctMeal`, `getDayTotals` |
| Health | `logWeight`, `logSleep`, `logHealthMetric` (generic), `getHealthSummary` |
| Social | `logFollowers`, `getSocialSummary` |
| Training | `startTrainingSession`, `logLift` (returns PR detection), `getCurrentSession`, `getRecentPRs` |
| Journal | `addJournalEntry`, `searchJournal` |
| Cross-cutting | `summarizeDay`, `summarizeWeek`, `setTheme` |
| Inbox (read-only) | `readInbox`, `searchEmail` |

Each tool is a Zod-typed Server Action exposed both to the UI (forms/buttons) and to the agent (via `tool()` helper in Vercel AI SDK).

### 4.4 Reply Format

1. **Text reply** — short, conversational, in the product voice (no emoji)
2. **Optional action chips** — up to 3, color-coded `sage` / `ember` / `honey` / neutral. Clicking a chip acts as if user typed that suggestion.
3. **Inline tool confirmations** — small mono captions: `✓ logged 175 lbs`, `✓ task added · 02 ITEMS DUE`

### 4.5 Latency Budget

- Target turn time: <3s (LLM + tools + DB writes + return)
- Streaming: agent text streams token-by-token; tool calls execute in background, confirmations appear as they finish
- Telegram: `sendChatAction(typing)` while agent thinks; final reply sent as a single message
- Degraded threshold: >10s = bug

### 4.6 Safety & Limits

- **Telegram allowlist**: hardcoded `chat_id`. Any message from another sender is silently dropped + logged to `error_events`
- **Rate limit**: 60 messages/min per channel per user, enforced via Postgres function on insert
- **Tool arg validation**: every tool call's args go through Zod before execution
- **RLS backstop**: agent runs as authenticated user; cannot write to another user's data
- **Destructive tool confirmation**: tools that delete (`removeHabit`, `cancelEvent`) carry `requires_confirmation: true`. Agent must ask first.

---

## 5. UI Architecture

### 5.1 Routing Structure

```
app/
├── (auth)/
│   ├── login/page.tsx           — Supabase magic link
│   └── callback/route.ts        — Auth callback
├── (app)/
│   ├── layout.tsx                — Picks <WebLayout> vs <MobileLayout> by viewport
│   ├── page.tsx                  — Dashboard (Home)
│   ├── finance/page.tsx
│   ├── health/page.tsx
│   ├── train/page.tsx
│   ├── social/page.tsx
│   ├── journal/page.tsx
│   └── settings/page.tsx
├── api/
│   ├── telegram/webhook/route.ts  — Phase 2
│   ├── plaid/webhook/route.ts
│   ├── whoop/webhook/route.ts
│   ├── gmail/sync/route.ts        — cron-triggered
│   ├── google-calendar/sync/route.ts — cron-triggered
│   ├── health-export/route.ts     — Health Auto Export → us
│   └── agent/turn/route.ts        — Phase 2
├── manifest.json
└── service-worker.ts
```

### 5.2 Layout Switching (Web vs Mobile)

Web 3-zone (`280px | 1fr | 340px`) and mobile single-column + bottom-tab layouts are materially different IA. CSS-responsive insufficient; we switch shells.

- `(app)/layout.tsx` reads viewport on client mount via `matchMedia('(min-width: 1024px)')`
- Renders `<WebLayout>` (3-zone grid) or `<MobileLayout>` (single column + bottom tabs)
- Server-side default: render `<MobileLayout>` (smaller HTML payload, faster mobile TTI). Hydration swaps to web on desktop
- Module components are layout-agnostic — same `<FinanceCard />` renders inside either shell

### 5.3 Theme System

- All design tokens defined as CSS variables in `app/globals.css` under `:root` (default = dark) and `[data-theme="cream"]` / `[data-theme="warm"]`
- Tailwind config exposes them as tokens: `bg-os-bg-2`, `text-os-fg-3`, `border-os-line-2`, etc.
- Theme preference in `profiles.theme`, applied via `<html data-theme={theme}>` on server render (no FOUC)
- Phase 1: Dark ships only. Cream/Warm token values land Phase 3 — token system already in place

### 5.4 State & Data Fetching

| Concern | Solution |
|---|---|
| Initial render | Server Components fetch via Supabase server client; HTML hydrates |
| Client cache + revalidation | SWR — stale-while-revalidate on focus/reconnect |
| Real-time updates | Supabase Realtime subscriptions in client components — table changes propagate to UI within ~200ms |
| Mutations | Server Actions for every write; `mutate()` invalidates affected SWR keys after success |
| Optimistic UI | Tap habit → SWR optimistic update (sage tint applies immediately) → server action confirms or rolls back |

### 5.5 Component Composition

- **shadcn/ui primitives** for: Dialog, DropdownMenu, Tooltip, Toast (Sonner), ScrollArea, Tabs, Sheet, Popover. Initialized via `npx shadcn@latest init`
- **Custom components** for: Card, TopBar, Sparkline, SessionCard, AgentPanelPlaceholder (Phase 1) → AgentPanel (Phase 2), HabitGrid, CalendarStrip, CaptureBar, ThemeSwitcher, ModuleHeader (NN// + TITLE + META row), chart bits (sparkbars, rings, EQ bar)
- **Folder layout**: `components/modules/` (one per module), `components/shell/` (layouts), `components/primitives/` (Card, Sparkline), `components/ui/` (shadcn-generated)

### 5.6 PWA Specifics

- `manifest.json`: name, short_name, theme_color `#0E1014`, background_color `#0E1014`, display `standalone`, icons 180/192/512, start_url `/`
- Apple-specific splash screen meta tags (auto-generated per iOS device via Next.js `metadata` export)
- Service worker via `next-pwa` or hand-rolled Workbox: offline shell (cached HTML), Web Push (Phase 2 agent alerts), background sync for stale Realtime reconnects
- One-time `<InstallPrompt />` on iOS Safari showing share-sheet instructions (iOS Safari has no `beforeinstallprompt`)

---

## 6. Integrations Spec (Phase 1B)

Five integrations. Each ships as a vertical slice. **Ship one before starting the next.**

### 6.1 Cross-Cutting Patterns

- **Connection state in `integrations` table** — one row per (user, provider): `provider`, `status`, `access_token` (encrypted via pgcrypto), `refresh_token`, `last_synced_at`, `last_error`, `metadata` jsonb
- **`source` column on every module table** — manual writes use `'manual'`, integration writes use their provider tag; source priority resolves conflicts at write time
- **Settings page (`/settings`) has Connections section** — one card per provider with status (color-coded), last-sync timestamp, primary action (Connect/Reconnect/Add another), destructive action (Disconnect — confirms first)
- **Failure handling** — sync failure → integration row marked `expired` or `error` → banner on dashboard ("WHOOP · 2 SYNC ERRORS · RECONNECT") → module renders last-known data with `⚠ STALE · 4h` chip
- **OAuth callback flow**: `/api/{provider}/callback` exchanges code for tokens → writes to `integrations` → kicks off initial backfill → redirects to `/settings?connected={provider}`

### 6.2 Plaid (Finance Pulse)

| Concern | Decision |
|---|---|
| Auth | Plaid Link (in-browser SDK popup); exchange `public_token` → `access_token` |
| Tier | Sandbox first, Production when ready to link real accounts. ~$30-100/mo for typical personal account count (3-5 institutions). Production pricing verified at implementation |
| Storage | `plaid_items` (per institution, holds access_token), `finance_accounts` (per account, current value), `finance_snapshots` (daily value per account) |
| Sync | Plaid webhooks → `/api/plaid/webhook` on `TRANSACTIONS` or `HOLDINGS` events. Daily cron also snapshots account values for sparkline continuity |
| Initial backfill | Current balances + last 30 days of transactions; generate 30 snapshots from balance history |
| Gotchas | Item expiry → handle `ITEM_LOGIN_REQUIRED` → mark integration `expired`, show reconnect banner. Crypto coverage varies by institution |

### 6.3 Google Calendar (Calendar module)

| Concern | Decision |
|---|---|
| Auth | Google OAuth 2.0 with `calendar.readonly` scope. Bundled with Gmail's `gmail.readonly` scope — one OAuth dance for both |
| Storage | `calendar_events` with `external_id` (Google event id) for idempotent upserts |
| Sync | Cron every 5 minutes pulls "next 7 days" with `singleEvents=true` to expand recurring instances |
| Initial backfill | Next 30 days + past 7 days |
| Gotchas | All-day events use `date` not `dateTime` (branch in formatter); time zones (store UTC, render in `profiles.timezone`) |

### 6.4 Whoop (Health module: Recovery, Strain)

| Concern | Decision |
|---|---|
| Auth | OAuth 2.0 via Whoop developer portal. **Risk**: API access in flux in 2026 — verify availability at implementation time. **Fallback**: drop direct Whoop integration; rely on Whoop's existing sync to Apple Health (Health Auto Export picks it up) |
| Storage | `health_snapshots` with `source: 'whoop'` |
| Sync | Webhook on new sleep/recovery; daily cron as backup |
| Initial backfill | Last 60 days |
| Gotchas | Whoop occasionally returns recovery before sleep finalized → latest-wins keyed on `(user_id, date)` |

### 6.5 Health Auto Export → Webhook (Apple HealthKit)

> ⚠ **DEPRECATED 2026-06-08.** Health Auto Export is being replaced by **direct HealthKit access in
> the native iOS app** (Swift), which becomes the sole Apple Health route. The HAE ingest path stays
> in prod only until the native HealthKit module ships, then it's removed. See
> `2026-06-08-personal-os-native-mobile-app-design.md` §3. The data landing zones
> (`health_snapshots`, `workouts`, source-tagged `apple_health`) are unchanged — only the transport
> changes (on-device HealthKit read instead of HAE REST push).

| Concern | Decision |
|---|---|
| Auth | Shared HMAC secret. iOS app POSTs JSON with `X-Signature: hmac-sha256(body, secret)`; verified on receipt |
| Setup | **Operator (Max) performs once manually**: (1) Install Health Auto Export from App Store (one-time paid app ~$5). (2) Configure REST API destination = `https://yourpersonalos.com/api/health-export`, secret = HMAC from Settings page. (3) Schedule hourly or daily. (4) Select metrics: Weight, Steps, VO2 Max, Active Energy, Heart Rate, HRV, Sleep. The Settings page surfaces the secret + instructions; acceptance gate confirms first POST received |
| Storage | `health_snapshots` with `source: 'apple_health'` |
| Initial backfill | Trigger Health Auto Export's one-time historical export after connection |
| Gotchas | Relies on phone being charged and connected. App format changes need parser updates. Setup is on the user (one-time) |

### 6.6 Gmail (Inbox tile)

| Concern | Decision |
|---|---|
| Auth | Google OAuth 2.0 with `gmail.readonly` (bundled with Calendar OAuth) |
| Storage | `gmail_threads` — `gmail_id`, `sender_name`, `sender_email`, `subject`, `snippet`, `received_at`, `is_unread`, `is_important`, `labels` |
| Sync | Cron every 10 minutes pulls "labels:INBOX since:max(received_at)-1h" |
| Initial backfill | Last 100 unread + 50 most recent read |
| Importance scoring | Gmail's native `IMPORTANT` label drives the "top 3-5 important threads." Fallback: 5 most recent unread |
| Gotchas | Filter `category:primary` to skip promotions/social. Eventual consistency on read state is OK |

### 6.7 Integration Setup UX

`/settings` page shows one card per provider:

```
┌────────────────────────────────────────────────────────────┐
│ PLAID                                                       │
│ Linked institutions: Chase · Schwab · Coinbase              │
│ Last synced 8m ago                                          │
│                                       [+ ADD] [DISCONNECT] │
└────────────────────────────────────────────────────────────┘
```

- Status color-coded sage/honey/rust
- Failures surface as dashboard banner: `⚠ WHOOP · 2 SYNC ERRORS · RECONNECT`
- Disconnect confirms first; destructive

---

## 7. Build Phases

No timeline. Sequence and acceptance gates only.

### Phase 1A — Foundations + Skeleton

**Ships:**

- Next.js 14+ App Router scaffolding, TypeScript strict, Tailwind, shadcn/ui init
- Vercel project linked, Supabase project linked, env vars wired
- Supabase Auth (magic-link), single user enabled, RLS on every table
- All 14 tables created via Supabase migrations (incl. `gmail_threads`, `integrations`, `agent_messages`, `sync_runs`, `error_events`)
- Design tokens: every CSS variable from `app.css` mapped into `globals.css` and Tailwind config. `data-theme="dark"` default; Cream/Warm placeholders defined (values empty)
- Web 3-zone layout + mobile single-column layout; viewport-aware switching
- Topbar (brand, tabs, live clock, me avatar), bottom nav (mobile)
- All 12 modules render as Cards with `NN //` headers and sample data
- All 5 secondary pages scaffolded with their layouts
- Manual entry working for every module: add task, toggle habit, log lift, log weight, log meal, add journal entry, add finance account, log social count
- Agent panel renders as `<AgentPanelPlaceholder />`: "11 // AGENT · PHASE 2"
- PWA manifest, theme color, basic icons, Apple splash meta
- Settings page with empty Connections section

**Acceptance gate:**

> Sign in via magic link → see all 12 modules and 5 secondary pages on web AND mobile → manually enter at least one row into every module → install to iPhone home screen → reload → data persists. Lighthouse PWA score ≥90.

### Phase 1B — Real Integrations

**Ships in this order** (one slice complete before the next starts):

1. **Gmail + Google Calendar** (bundled — one OAuth dance covers both scopes)
2. **Health Auto Export → Webhook**
3. **Whoop** — designed as its own slice with direct OAuth integration. If at implementation time the Whoop API is inaccessible, this slice is **dropped from Phase 1B entirely** (not silently merged into HAE). Whoop data still arrives via Apple Health → HAE, which is already shipped in the prior slice; the Health module renders that data. The "Whoop slice" acceptance gate is conditional: ship the integration if API works, otherwise mark the slice as "skipped — covered by HAE" and proceed
4. **Plaid** (Sandbox first, then Production)

For each slice:
- OAuth/setup flow on `/settings`
- Initial backfill on first connect
- Sync mechanism (webhook handler or cron job)
- Failure handling, stale-data banner, reconnect UX
- Module on dashboard reflects real provider data; manual entry remains as fallback

**Acceptance gate per slice:**

> Provider connected via `/settings` → initial backfill completes → at least one fresh sync from the provider lands in DB → module on dashboard reflects real data → disconnect/reconnect cycle works → forced sync failure (e.g., revoke token in provider's UI) surfaces a banner within 15 minutes.

**Acceptance gate overall:**

> All 5 integrations live, settings page all green, no stale-data banners on a typical day. Dashboard is true source of truth for finances, calendar, email, and health.

### Phase 1C — Polish + Daily Use

**Ships:**

- Performance pass: LCP <2s cold, tap-to-response <100ms, sparkline render <16ms
- Error boundaries per module (one failing card doesn't kill the page)
- Toast system (shadcn Sonner) for action confirmations
- Empty states designed for every module (mono caption, no blank blocks)
- E2E test suite (Playwright): auth, manual entry per module, OAuth callback per integration, sync resilience
- Acceptance checklist from `design_handoff_personal_os/README.md:449-467` ticked
- `.tmp/dogfood-notes.md` — running list of friction during daily use

**Acceptance gate:**

> 14 consecutive days of daily use where: you open Personal OS at least once per day → data is correct, fresh, useful → integration sync breakage is detected within the day and recoverable → design acceptance checklist passes → no uncaught exceptions surfaced to user.

### Phase 2 — Agent

**Ships:**

- Vercel AI SDK + Anthropic provider + Claude Sonnet 4.6 wired; prompt caching enabled
- ~30 typed tool definitions backed by existing Phase 1 server actions
- State digest builder
- AgentPanel replaces placeholder: streaming chat, typing indicator, sage/agent bubbles, action chips
- Web + mobile capture bars wired to `/api/agent/turn`
- Telegram bot via BotFather; token in env; allowlist `chat_id`; `/api/telegram/webhook` accepts updates
- Telegram `typing` action while agent thinks
- `agent_messages` activated as the single conversation thread across all channels
- Realtime subscription on `agent_messages` — UI agent panel reflects Telegram-channel messages live

**Acceptance gate:**

> You can talk to the agent via Telegram, web capture, or mobile capture. Agent reads current state and writes to any module via tool calls. Over 100 sample turns: ≥95% tool call success, replies stream within 3s typical, conversation context persists across sessions. Agent never destroys data without confirming first.

### Phase 3 — Stretch / Optional

No commitment to ship. Decided based on Phase 1C dogfood + Phase 2 actual usage.

- Cream + Warm themes (token values filled in, theme switcher exposed)
- Structured agent memory ("facts about Max" store)
- Voice messages (Telegram voice → Whisper → text turn)
- Meal photo → kcal estimate (image input + tool)
- Search / command palette (⌘K real)
- Web Push for agent alerts ("Plaid item needs reauth")
- Long-running agent jobs (weekly review, monthly summary) — Vercel Workflow if needed
- "No-API" modules: Hevy or CSV import for training; scraping/paid tiers for X/LinkedIn/Substack/IG
- ~~iOS-native app (if PWA limits prove painful)~~ — ⚠ **PROMOTED 2026-06-08:** this materialized and is now a committed direction (full native iOS app, React Native + Swift), not a stretch item. See `2026-06-08-personal-os-native-mobile-app-design.md`.

---

## 8. Testing & Acceptance

### 8.1 Test Strategy

| Layer | Tool | Coverage | Volume |
|---|---|---|---|
| Unit | Vitest | Pure logic: formatters, sparkline math, source-priority resolution, Zod schemas | ~30-50 tests |
| Integration | Vitest + Supabase test client | Server actions: auth → mutation → DB row → RLS check, one spec per module's tool catalog | ~30-40 tests |
| E2E | Playwright | Critical flows in real browser | ~10-15 specs |

**E2E critical flows (must-pass):**

1. Magic-link sign in → land on dashboard → see your data
2. Manual entry for each module (tap habit, add task, log lift, etc.) → DB write → UI update
3. Each integration: OAuth connect → backfill completes → module shows real data
4. Sync failure simulation: revoke token at provider → next sync fails → banner appears within 15min
5. Realtime: open two tabs → write in tab A → tab B updates without refresh
6. PWA: install on iPhone Safari → launch from home screen → standalone mode confirmed
7. Mobile layout switching: resize viewport across breakpoint → correct shell renders

### 8.2 Out-of-Scope Testing

- Visual regression / snapshot tests (use design acceptance checklist instead)
- Third-party SDK internals (Plaid Link, Google APIs, Anthropic SDK assumed to work)
- Multi-user scenarios (RLS enforced but not formally tested)
- Browser matrix beyond Safari + Chrome
- WCAG accessibility audit (baseline semantic HTML + keyboard navigation; no formal audit)

### 8.3 Measurable Acceptance — "Works Very, Very Well"

**Performance:**

| Metric | Target | Bug threshold |
|---|---|---|
| Dashboard LCP (desktop, cold) | <1.5s | >2.5s |
| Dashboard LCP (mobile 4G) | <2s | >3s |
| Tap → response (any interaction) | <100ms | >300ms |
| Sparkline render | <16ms | >32ms |
| Agent reply first token (Phase 2) | <1.5s | >3s |
| Agent reply full turn (Phase 2) | <3s typical | >10s |

**Data freshness:**

| Integration | Sync cadence | Stale-data threshold |
|---|---|---|
| Plaid | webhook + nightly cron | >24h |
| Google Calendar | 5-min cron | >30min |
| Gmail | 10-min cron | >1h |
| Whoop | webhook + daily cron | >36h |
| Health Auto Export | inbound | >36h |

**Reliability:**

- Sync success rate ≥99% week-over-week per integration
- Agent tool-call success rate ≥95% over rolling 100 turns (Phase 2)
- Zero uncaught exceptions surfaced to user in rolling 14-day dogfood window

### 8.4 Visual Fidelity Gate

Walk through the design handoff acceptance checklist (`design_handoff_personal_os/README.md:449-467`) and tick each item.

### 8.5 Observability

- **Vercel Observability** — request logs, function durations, error rates
- **Supabase Logs** — DB queries, auth events, Realtime stats
- **`sync_runs` table** — per-sync row: provider, started_at, finished_at, rows_synced, status, error_message; powers freshness banners
- **`error_events` table** — server action exceptions; settings page exposes recent errors expandable section
- **Daily heartbeat cron** at 7am: checks each integration's `last_synced_at`, surfaces stale >24h as banner (Phase 1) or Web Push (Phase 2)

### 8.6 CI/CD

- **Vercel preview deployments** per branch with ephemeral Supabase environment (Supabase branch databases)
- **Pre-merge checks** (GitHub Actions): typecheck, lint, Vitest unit + integration, Playwright E2E against preview URL
- **Migrations**: Supabase CLI SQL diffs committed to repo, applied via `supabase db push` in CI to staging → production after merge to `main`
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) + branch naming (`feature/*`, `fix/*`) per global CLAUDE.md
- **No skipping hooks** — pre-commit and pre-push run typecheck + lint locally

---

## 9. Open Questions and Risks

### 9.1 Open Questions (resolve during implementation)

| Q | Resolution path |
|---|---|
| Final Plaid pricing tier and per-Item cost | Verify at implementation; revisit Sandbox-vs-Production gate |
| Whoop API access in 2026 | Verify availability; if blocked, drop direct integration and rely on Apple Health route |
| Health Auto Export field schema (current version) | Read app's docs at implementation; build parser to match |
| Exact list of important Gmail labels to surface | Trial: start with Gmail's `IMPORTANT`; revisit if signal is poor |
| Mobile breakpoint — exact pixel value | Default 1024px (Tailwind `lg`); adjust if iPad-portrait feels wrong |
| Magic-link sender domain | Use Supabase default sender for v1; switch to custom domain (Resend) only if deliverability issues arise |

### 9.2 Risks

- **Plaid cost escalation** — production tier prices change; mitigate by starting Sandbox, monitoring usage, considering Teller as alternative
- **Whoop API instability** — flagged above; fallback documented
- **iOS PWA limits** — push notifications, background sync limits may bite later; not Phase 1 blocker
- **Idea-hopping mid-build** — flagged in Context (Section 0); discipline = ship-when-end-to-end-works per slice
- **Single-user-only assumption hardcoded somewhere** — RLS keys to `auth.uid()`, so this is structurally fine, but code reviews should watch for any "first user" shortcuts that wouldn't generalize

### 9.3 Decisions Deferred to Implementation Planning

- Exact migration order (foundations → tables → seed data sequencing)
- Exact shadcn component set vs custom-built
- Whether to use `next-pwa` or hand-roll Workbox service worker
- Whether to use Supabase branching for ephemeral preview DBs from day one or land it later
- Telegram bot username / handle

---

## 10. Appendix

### 10.1 Tech Stack Summary

```
Next.js 14+ App Router   (framework)
TypeScript strict        (language)
Tailwind CSS             (styling)
shadcn/ui                (UI primitives)
Supabase                 (Postgres + Auth + Realtime + Storage)
SWR                      (client cache)
Server Actions           (mutations)
Vercel                   (hosting)
Vercel AI SDK            (LLM, Phase 2)
Claude Sonnet 4.6        (model, Phase 2)
Anthropic SDK            (provider, Phase 2)
Zod                      (validation)
Vitest                   (unit + integration tests)
Playwright               (E2E tests)
Supabase CLI             (migrations)
```

### 10.2 Module Numbering (from design handoff)

```
01 OPERATOR       — Identity card
02 SESSION        — Greeting, clock, capture bar
03 FINANCE PULSE  — Net worth, sparkline
04 TODAY · KEY    — High-priority tasks
05 HABITS         — Daily score, 6-cell grid
06 CALENDAR       — Today + 7-day strip
07 NUTRITION      — kcal ring, macros, meals
08 HEALTH         — Sleep, recovery, HRV
09 SOCIAL         — Follower total + breakdown
10 TRAINING       — Today's split, recent PRs
11 AGENT          — Right-rail chat panel (Phase 2)
12 INBOX          — Gmail tile (new, not in original handoff)
```

### 10.3 Referenced Files

- `design_handoff_personal_os/README.md` — full design handoff with token specs
- `design_handoff_personal_os/prototype/app/app.css` — visual system, all themes
- `design_handoff_personal_os/prototype/hearth.css` — upstream design system tokens
- `design_handoff_personal_os/prototype/app/components-modules.jsx` — module reference implementations
- `design_handoff_personal_os/prototype/app/agent.jsx` — agent panel reference (Phase 2)
- `design_handoff_personal_os/prototype/app/data.js` — sample data shapes

### 10.4 Glossary

- **PWA** — Progressive Web App; web app installable on home screen, runs standalone
- **RLS** — Row-Level Security (Postgres policies that filter rows by user)
- **HAE** — Health Auto Export (iOS app that posts HealthKit data to a webhook)
- **TTI** — Time To Interactive
- **LCP** — Largest Contentful Paint
- **The spine** — Capture bar → Agent → Tool call → DB → UI render loop (Phase 2)
- **Source of truth** — The product positioning: Personal OS is the canonical place data lives, not a viewer over data living elsewhere
