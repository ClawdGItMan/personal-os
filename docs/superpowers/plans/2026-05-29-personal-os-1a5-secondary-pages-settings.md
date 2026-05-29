# Personal OS — Plan 1A.5: Secondary Pages + Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Wave 0 is **serial** (shared files); Wave 1 fans out **one worktree-isolated agent per page** (disjoint file-sets — the 1A.2 contention lesson). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the five placeholder secondary pages (Finance/Health/Train/Social/Journal) with full, real-data read views matching the design prototype, and add a new Settings page (editable profile, a dark-only theme switcher, and an empty Connections placeholder for Phase 1B) — so Phase 1A's "see all 12 modules and 5 secondary pages" acceptance criterion is met with the operator's real data.

**Architecture:** Each secondary page is an `async` Server Component that returns a bare `<>` fragment (the shell owns padding/gaps), fetches its own data inline via `await createClient()` (RLS scopes rows — no manual `user_id` filter), and composes `Card`s plus a small set of new shared presentational primitives (`PageHeader`, `Sparkbars`, `StatRow`, `KpiRow`, `StatCell`). Secondary pages are **read-only** (the prototype has no forms; manual entry already shipped on the dashboard cards in 1A.4). Settings is the **only** new write path: a `"use client"` `ProfileForm` backed by a new Zod-validated `updateProfile` server action (the single write path), plus static Appearance and Connections cards.

**Tech Stack:** Next.js 16 App Router, React 19 (`useTransition`), Tailwind 4 (existing `@theme`/`--os-*` tokens), Zod v4, TypeScript strict. **No new dependencies.**

**Spec reference:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` §5.1 (routing — the 5 secondary routes + `/settings`), §5.3 (theme system — **dark ships only; Cream/Warm deferred to Phase 3**), §6.1/§6.7 (Settings has a Connections section, one card per provider — built empty here, wired in 1B), §7 Phase 1A acceptance gate ("see all 12 modules and 5 secondary pages on web AND mobile"). Design source: `design_handoff_personal_os/prototype/app/pages.jsx` (FinancePage/HealthPage/TrainPage/SocialPage/JournalPage) + `components-shared.jsx`. Accessibility posture is spec §8.2: **baseline semantic HTML + keyboard navigation; no formal WCAG audit.** (Note: the spec has no §5.7/§5.8 — earlier briefs mis-numbered; cite §5.1/§5.3/§5.6/§7.)

---

## Design facts (from prototype + existing-code analysis — authoritative)

- **Page shell:** pages return a bare `<>` fragment of stacked `Card`s. `WebLayout` center column is `flex flex-col gap-3 pt-3`; `MobileLayout` wraps children in `px-4 pt-3 pb-[100px]`. **Do not add page padding/wrappers.** The first child is a `<PageHeader>`.
- **Card numbering restarts per secondary page** (prototype convention): `01`, `02`, `03`… on each page (NOT the dashboard's stable 03/08/09/10 taxonomy). Headers come from `<Card num="01" title="…" meta="…">`, never hand-written.
- **Page title block** (prototype `.page__title` + `.page__sub`): serif title with an italic accent emphasis token, then a mono ALL-CAPS eyebrow. Encapsulated in the new `PageHeader` primitive.
- **Real data only — never fabricate.** The prototype hardcodes many series/deltas (week deltas, glucose, split schedule). Render a metric only when the user's data supports it; otherwise show an `EmptyState` or omit the sub-stat. No invented numbers (the operator evaluates by outcomes; fake data is worse than an honest empty state).
- **Tables & columns** (from `src/lib/supabase/database.types.ts`): `finance_accounts(name,type,current_value,source)`, `finance_snapshots(account_id,date,value)`, `health_snapshots(date,weight,weight_unit,sleep_score,sleep_hours,recovery_score,hrv,rhr,steps,strain,vo2_max,source)` (one row per `user_id,date`), `training_sessions(split_name,started_at,notes)`, `lifts(session_id,name,weight,weight_unit,reps,sets,is_pr)`, `social_followers(platform,count,date,source)` (unique `user_id,platform,date`), `journal_entries(text,tags,mentions,written_at)`, `profiles(name,initials,role,location,focus,streak,timezone,theme)`. **No `glucose` column** (drop the prototype's GLUCOSE card). **No split-schedule table** (replace the prototype's SPLIT card with a "RECENT PRS" card from `lifts.is_pr`).
- **Tokens/classes:** colors via `bg-[color:var(--os-bg-2)]`, `text-[color:var(--os-fg-3)]`, `border-[color:var(--os-line-1)]`, `text-[color:var(--os-accent)]`, `--os-rust` (down/errors), `--os-honey` (PR/stars). Radii: `rounded-os-card`, `rounded-os-inner`, `rounded-os-pill`. `font-mono` for all labels/numbers/captions; `font-display` for serif titles/journal body; `os-tnum` on numbers. Form styles from `@/components/modules/_field.ts` (`FIELD`, `BTN`, `ERR`). No emoji in chrome.
- **Helpers** (`@/lib/format`): `fmtUSD`, `fmtUSDDelta`, `fmtPct`, `fmtDate`, `todayISO`, `initialsFrom`. **Reuse — do not re-implement.**
- **Write path** (every mutation): `"use server"` → Zod `safeParse` → `getCurrentUserId()` (from `@/lib/auth`) → `await createClient()` (from `@/lib/supabase/server`) → write with explicit `user_id`/`id` → `revalidatePath` → return `ActionResult` (from `@/lib/action-result`).

---

## File Structure (after this plan)

```
src/
├── components/
│   └── primitives/
│       ├── PageHeader.tsx              [CREATE — serif title + italic em + mono eyebrow]
│       ├── Sparkbars.tsx               [CREATE — CSS bar chart, last-N highlighted]
│       ├── StatRow.tsx                 [CREATE — icon · name/sub · value · delta row]
│       ├── KpiRow.tsx                  [CREATE — inline value+label KPI cluster]
│       └── StatCell.tsx                [CREATE — raised label/value/sub cell]
├── app/(app)/
│   ├── _actions/
│   │   └── profile.ts                  [CREATE — updateProfile (single write path)]
│   ├── finance/page.tsx                [REPLACE placeholder — full Finance read view]
│   ├── health/page.tsx                 [REPLACE placeholder — full Health read view]
│   ├── train/page.tsx                  [REPLACE placeholder — full Train read view]
│   ├── social/page.tsx                 [REPLACE placeholder — full Social read view]
│   ├── journal/page.tsx                [REPLACE placeholder — full Journal read view]
│   └── settings/
│       ├── page.tsx                    [CREATE — async: getOperator → cards]
│       ├── ProfileForm.tsx             [CREATE — "use client" profile editor]
│       ├── AppearanceCard.tsx          [CREATE — dark-only theme switcher (static)]
│       └── ConnectionsCard.tsx         [CREATE — empty Phase-1B provider placeholder]
├── components/shell/
│   ├── TopBar.tsx                      [MODIFY — operator avatar → Link /settings]
│   ├── MobileTopBar.tsx               [MODIFY — add initials chip → Link /settings]
│   └── LeftRail.tsx                    [MODIFY — add SETTINGS row to QUICK SWITCH]
└── tests/e2e/secondary-pages.spec.ts   [CREATE — unauth redirect coverage for /settings + pages]
```

---

## Conventions (carry from existing code)

- Path alias `@/*` → `src/*`. `"use client"`/`"use server"` always explicit. Components < 150 lines (extract if larger).
- Server-component pages: `const operator = await getOperator(); if (!operator) redirect("/login");` only where the page needs operator fields (Settings, page headers that show identity). Pages that only read module tables can skip the operator fetch (auth is enforced in `layout.tsx` + middleware), but **Settings and any page using a derived greeting must guard**.
- Reads: destructure `{ data }`, always `data ?? []`, `select()` only needed columns, `Number(...)` to coerce numerics, date filters use `` `${todayISO()}T00:00:00` `` or `.gte("date", <iso>)`.
- New shared primitives are **server-safe** (no `"use client"`, no hooks) so server pages can render them directly.

---

## Wave 0 — Serial prereq (lead agent / single agent, before any page)

> Shared files. Per the 1A.2 lesson, all cross-cutting scaffolding lands here, serially, so Wave-1 page agents touch only their own route folder.

### Task 0a: Shared presentational primitives

**Files:** Create `src/components/primitives/{PageHeader,Sparkbars,StatRow,KpiRow,StatCell}.tsx`.

- [ ] `PageHeader.tsx` — props `{ title: string; emphasis?: string; sub: string }`. Renders a `<header>`: serif `<h1>` (`font-display text-[2rem] leading-tight tracking-[-0.02em] text-[color:var(--os-fg-1)]`) with `title` then, if `emphasis`, a space + `<em className="italic text-[color:var(--os-accent)]">{emphasis}</em>`; below, `<p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--os-fg-4)]">{sub}</p>`.
- [ ] `Sparkbars.tsx` — props `{ data: number[]; height?: number; highlightFrom?: number; color?: string }`. Flex row, `items-end`, gap-[2px], height `height ?? 56`. Each bar a `<div>` with height `${(v/max)*100}%` (guard `max>0`), `min-h-[2px]`, `rounded-[1px]`; bars at index `>= (highlightFrom ?? data.length)` use `color ?? var(--os-accent)`, others `var(--os-line-2)`. Returns `null`/empty `<div style={{height}}>` if `data.length === 0`. `aria-hidden`.
- [ ] `StatRow.tsx` — props `{ icon: string; name: string; sub?: string; value: string; delta?: string; deltaDown?: boolean }`. CSS grid `grid-cols-[28px_1fr_auto] gap-3 items-center py-2.5 border-t border-[color:var(--os-line-1)] first:border-t-0`. Icon = 28px `rounded-os-inner bg-[color:var(--os-bg-3)] font-mono text-[10px]` centered. Middle: `name` (`text-sm text-[color:var(--os-fg-1)]`) + optional `sub` (`font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]`). Right: `value` (`font-mono os-tnum text-sm text-[color:var(--os-fg-1)]`) + optional `delta` (`font-mono text-[10px]`, `text-[color:var(--os-accent)]` or `text-[color:var(--os-rust)]` when `deltaDown`).
- [ ] `KpiRow.tsx` — props `{ items: { value: string; label: string; accent?: boolean }[] }`. Flex row gap-6. Each item: value (`font-mono os-tnum text-lg`, accent → `text-[color:var(--os-accent)]` else `text-[color:var(--os-fg-1)]`) over label (`font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)] mt-0.5`).
- [ ] `StatCell.tsx` — props `{ label: string; value: string; sub?: string; accent?: boolean }`. Raised cell: `bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-1)] rounded-os-inner p-3`. label (mono caps `--os-fg-4`), value (`font-mono os-tnum text-lg`, accent→`--os-accent`), optional sub (mono `--os-fg-4`).
- [ ] Verify: `pnpm tsc --noEmit` (expect 0).
- [ ] Commit: `feat: add PageHeader/Sparkbars/StatRow/KpiRow/StatCell primitives (1A.5)`.

### Task 0b: `updateProfile` server action

**Files:** Create `src/app/(app)/_actions/profile.ts`.

- [ ] **First read** `src/lib/operator.ts` and `src/lib/supabase/database.types.ts` to confirm the `profiles` primary key and column set (does it key on `id` or `user_id`? does it have an `initials` column?). **Match `getOperator`'s column usage exactly.**
- [ ] Implement `updateProfile(input: unknown): Promise<ActionResult>`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { initialsFrom } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const UpdateProfile = z.object({
  name: z.string().min(1, "Name required").max(80),
  role: z.string().max(80),
  location: z.string().max(80),
  focus: z.string().max(160),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = UpdateProfile.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  // NOTE: confirm the PK column + presence of `initials` against database.types.ts before finalizing.
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        name: parsed.data.name,
        initials: initialsFrom(parsed.data.name),
        role: parsed.data.role,
        location: parsed.data.location,
        focus: parsed.data.focus,
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  // The operator avatar/OperatorCard is mounted in the shell on every (app) route —
  // revalidate the whole layout so initials/name refresh app-wide, not just on /dashboard.
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] Verify: `pnpm tsc --noEmit` (expect 0; fix the `onConflict`/columns if database.types.ts disagrees).
- [ ] Commit: `feat: add updateProfile server action (1A.5)`.

### Task 0c: Reach Settings from chrome

**Files:** Modify `src/components/shell/TopBar.tsx`, `src/components/shell/MobileTopBar.tsx`, `src/components/shell/LeftRail.tsx`.

- [ ] `TopBar.tsx`: wrap the operator initials avatar chip in `<Link href="/settings" aria-label="Settings">…</Link>` (keep the existing chip styling; add `hover:border-[color:var(--os-line-2)]`). Import `Link` from `next/link`.
- [ ] `MobileTopBar.tsx`: **add `import Link from "next/link";`** (it currently imports only `useClock`/`fmtClock`). Add a right-aligned initials chip (mirror the web avatar: `rounded-os-pill bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-1)] text-[color:var(--os-fg-2)] font-mono text-[10px] w-7 h-7`) wrapped in `<Link href="/settings" aria-label="Settings">`. `MobileTopBar` takes no props today and `MobileLayout` receives no `operator` — thread `initials` one hop: `(app)/layout.tsx` (where `operator` is in scope) → `MobileLayout` prop → `MobileTopBar` prop. This is a one-prop thread, not heavy plumbing — **do it; no `·`-glyph fallback** (DoD #3 requires a real operator-avatar entry point on mobile). Both the TopBar and MobileTopBar `<Link>`s render in the server tree regardless of viewport (AppShell only swaps which shell is visible), so there is no SSR/hydration concern.
- [ ] `LeftRail.tsx`: after the `WEB_TABS` map inside the QUICK SWITCH `Card`, append one more `<Link href="/settings">SETTINGS</Link>` styled identically to the other quick-switch links, with active state on `pathname === "/settings"`. Do **not** add SETTINGS to `WEB_TABS` (keep the top-nav at 6 tabs).
- [ ] Verify: `pnpm tsc --noEmit` && `pnpm lint` (expect 0).
- [ ] Commit: `feat: link operator avatar + quick-switch to /settings (1A.5)`.

**Gate:** Wave 0 must be `tsc`/`lint` clean and committed before Wave 1 starts.

---

## Wave 1 — Page builds (one worktree agent each; independent file-sets)

> Each task owns exactly one route folder and touches no shared files (it only *consumes* Wave 0 primitives). Safe to run as parallel worktree agents. Each: build → `pnpm tsc --noEmit` → commit.

### Task 1: Finance page
- Files: `src/app/(app)/finance/page.tsx` (replace placeholder; `async` server component).
- Reads: `finance_accounts` → `select("id,name,type,current_value").order("current_value",{ascending:false})`; `finance_snapshots` → `select("date,value").gte("date", <30d ago ISO>).order("date")`, summed per `date` into a `number[]` series (net worth over time).
- Compose:
  - `<PageHeader title="Net worth ·" emphasis={fmtUSD(total)} sub={\`FINANCE · ${accounts.length} ACCOUNTS\`} />` (total = Σ `current_value`).
  - `<Card num="01" title="PORTFOLIO TRAJECTORY" meta="30D">`: `<Sparkline data={series} height={120} />` when `series.length >= 2`, else `<EmptyState caption="No snapshot history yet" />`. If ≥2 points, a `grid grid-cols-3 gap-2` of `<StatCell>` for first→last change ("Period" Δ `fmtUSDDelta`, and `fmtPct`); only render deltas you can actually compute — no hardcoded week/month figures.
  - `<Card num="02" title="ACCOUNTS" meta={\`${accounts.length} CONNECTED\`}>`: `<StatRow>` per account (`icon={a.type.slice(0,2)}`, `name={a.name}`, `sub={a.type}`, `value={fmtUSD(a.current_value)}`). Empty → `<EmptyState caption="No accounts yet — add one from the dashboard" />`.
  - `<Card num="03" title="ALLOCATION" meta="BY CLASS">`: group accounts by `type`, render a single horizontal stacked bar (segment widths = share of total, segment colors from a small `type→token` map using literal CSS-var strings: `EQUITY→var(--os-accent)`, `CRYPTO→var(--os-ember)`, `RETIRE→var(--os-honey)`, others→`var(--os-fg-3)`/`var(--os-fg-4)` ramp) + a legend list (`type` · `fmtUSD` · `share%`). Skip the card entirely if no accounts.
- Empty-state behavior: if there are zero accounts AND zero snapshots, the page still renders the `PageHeader` (with `$0`) and a single `EmptyState`.
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Finance secondary page (1A.5)`.

### Task 2: Health page
- Files: `src/app/(app)/health/page.tsx` (replace placeholder; `async`).
- Reads: latest snapshot `health_snapshots` → `select("*").order("date",{ascending:false}).limit(1)` → `latest`; history → `select("date,weight,hrv,steps").order("date").limit(30)` for series.
- Compose:
  - `<PageHeader title="Body ·" emphasis={recovery >= 66 ? "recovered." : "recovering."} sub="HEALTH" />` (fallback emphasis `"—"` when no `latest`).
  - `<Card num="01" title="THIS MORNING" meta="LATEST">`: three `<Ring>` — Recovery (`pct={recovery_score} center={String(recovery_score)} sub="RECOVERY"`), Sleep (`pct={sleep_score} center={String(sleep_score)} color="var(--os-honey)" sub="SLEEP"`), Strain (`pct={(strain/21)*100} center={strain.toFixed(1)} color="var(--os-ember)" sub="STRAIN"`). **`Ring`'s `center` prop is required (no default) — every ring must pass it.** Render only rings whose metric is non-null. (`Ring` default `size` 56 fits the row.) Beside them a `kpi-big` for `sleep_hours`. If `latest` is null → `<EmptyState caption="No health data yet — log weight from the dashboard" />` and skip the metric cards below.
  - `grid sm:grid-cols-3 gap-3`: `<Card num="02" title="HRV" meta="ms">` kpi + `<Sparkbars data={hrvSeries} highlightFrom={…} />`; `<Card num="03" title="WEIGHT" meta={unit}>` kpi + `<Sparkline data={weightSeries} height={48} />`; `<Card num="04" title="STEPS">` kpi + `<Sparkbars data={stepSeries} />`. Each renders an inline "—" / mini empty caption when its metric/series is absent.
  - `grid sm:grid-cols-2 gap-3`: `<StatCell>`-style `<Card num="05" title="RHR" meta="bpm">` and `<Card num="06" title="VO2 MAX">` when those columns are non-null; omit otherwise. (No GLUCOSE — not in schema.)
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Health secondary page (1A.5)`.

### Task 3: Train page
- Files: `src/app/(app)/train/page.tsx` (replace placeholder; `async`).
- Reads: latest session `training_sessions` → `select("id,split_name,started_at,notes").order("started_at",{ascending:false}).limit(1)`; its lifts `lifts` → `select("name,weight,weight_unit,reps,sets,is_pr").eq("session_id", latest.id)`; recent sessions for volume `training_sessions` (last ~8) joined to `lifts` (or per-session lift sums) → weekly volume series; recent PRs `lifts` → `select("name,weight,weight_unit,created_at").eq("is_pr", true).order("created_at",{ascending:false}).limit(6)`.
- Compose:
  - `<PageHeader title={latest?.split_name ?? "Training"} emphasis={latest ? undefined : "no session yet"} sub={latest ? fmtDate(new Date(latest.started_at)) : "TRAIN"} />`.
  - `<Card num="01" title="SESSION LIFTS" meta={\`${lifts.length} LIFTS\`}>`: a lift table — per lift row: `SET n` / `name` / `{reps} × {weight}{unit}` / `★ PR` (honey) when `is_pr`. Empty → `<EmptyState caption="No sessions yet — start one from the dashboard" />`.
  - `<Card num="02" title="VOLUME · 8 WEEKS">`: `<Sparkbars data={volumeSeries} height={90} />` + `<KpiRow items=[{value: latest week volume, label:"This week", accent:true}, {value: Δ vs prior, label:"vs prior"}] />`. Skip if no sessions.
  - `<Card num="03" title="RECENT PRS">`: `<StatRow>` per PR (`icon="PR"`, name, value=`{weight}{unit}`, sub=fmtDate). Empty → `<EmptyState caption="No PRs logged yet" />`. (Replaces the prototype's hardcoded SPLIT schedule — we have no split-schedule data source.)
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Train secondary page (1A.5)`.

### Task 4: Social page
- Files: `src/app/(app)/social/page.tsx` (replace placeholder; `async`).
- Reads: `social_followers` → `select("platform,count,date").order("date",{ascending:false})`. Reduce to **latest count per platform** (first row per platform after desc sort); build a per-`date` total series (sum across platforms) for the last ~30 distinct dates.
- Compose:
  - `<PageHeader title="Audience ·" emphasis={total.toLocaleString()} sub={\`SOCIAL · ${platforms.length} PLATFORMS\`} />` (total = Σ latest per platform).
  - `<Card num="01" title="GROWTH · 30D">`: `<Sparkbars data={totalSeries} height={100} highlightFrom={…} />` + `<KpiRow items=[{value: netNew, label:"Net new", accent:true}] />` (netNew = last − first of series; only if series ≥ 2). Empty → small caption.
  - `<Card num="02" title="PLATFORMS" meta={\`${platforms.length}\`}>`: `<StatRow>` per platform (`icon={platform.slice(0,2)}`, name=platform, sub="FOLLOWERS", value=`count.toLocaleString()`). Empty → `<EmptyState caption="No followers logged yet — add a count from the dashboard" />`.
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Social secondary page (1A.5)`.

### Task 5: Journal page
- Files: `src/app/(app)/journal/page.tsx` (replace placeholder; `async`).
- Reads: `journal_entries` → `select("id,text,tags,written_at").order("written_at",{ascending:false}).limit(50)`.
- Compose:
  - `<PageHeader title="Journal ·" emphasis={\`${entries.length} ${entries.length === 1 ? "entry." : "entries."}\`} sub="BRAIN · RECENT" />`.
  - One `<Card>` per entry: `num={String(i+1).padStart(2,"0")}`, `title` = short derived label (first line of `text`, truncated ~48 chars, uppercased — or `fmtDate(written_at)` if the first line is long), `meta` = `fmtDate(new Date(written_at))` + time. Body: `<p className="font-display text-[17px] leading-relaxed text-[color:var(--os-fg-2)] whitespace-pre-wrap">{text}</p>`. Render `tags` as small mono pills if present.
  - Empty → `<EmptyState caption="No entries yet — capture one from the dashboard" />`.
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Journal secondary page (1A.5)`.

### Task 6: Settings page
- Files: Create `src/app/(app)/settings/page.tsx` (`async` server component) + `src/app/(app)/settings/{ProfileForm,AppearanceCard,ConnectionsCard}.tsx`.
- `page.tsx`: `const operator = await getOperator(); if (!operator) redirect("/login");` then:
  - `<PageHeader title="Settings ·" emphasis="console." sub="SYSTEM · MAX OS" />`.
  - `<Card num="01" title="OPERATOR" meta="PROFILE"><ProfileForm operator={operator} /></Card>`.
  - `<Card num="02" title="APPEARANCE" meta="THEME"><AppearanceCard /></Card>`.
  - `<Card num="03" title="CONNECTIONS" meta="PHASE 1B"><ConnectionsCard /></Card>`.
- `ProfileForm.tsx` (`"use client"`): controlled inputs for `name`, `role`, `location`, `focus` (prefilled from `operator`), a Save `<button>`. On submit: `useTransition` → `await updateProfile({...})` → on `res.ok` show a transient `✓ SAVED` mono caption, else `setError(res.error)`. Use `FIELD`/`BTN`/`ERR` from `@/components/modules/_field`. Labeled inputs (`<label htmlFor>`), keyboard-submittable `<form>`.
- `AppearanceCard.tsx` (server-safe): a segmented control of three pills — **Dark** (selected: `bg-[color:var(--os-bg-2)] border-[color:var(--os-line-2)] text-[color:var(--os-fg-1)]`), **Cream** and **Warm** (`disabled` look: `opacity-50 cursor-not-allowed`, each captioned). Below: `<p>` mono caption "Cream & Warm themes arrive in Phase 3 (spec §5.3). Dark ships today." **No live theming wired** — purely presentational; do not write `profiles.theme`.
- `ConnectionsCard.tsx` (server-safe): one `<StatRow>`-style row per Phase-1B provider — **Plaid** (FINANCE), **Google** (CALENDAR · GMAIL), **Whoop** (HEALTH), **Health Auto Export** (APPLE HEALTH), **Gmail** is covered by Google (so list: Plaid, Google, Whoop, Health Auto Export — 4 rows, with Google noting "Calendar + Gmail") — each with a `NOT CONNECTED` pill (`text-[color:var(--os-fg-4)] border-[color:var(--os-line-2)] rounded-os-pill`) and a disabled "Connect" affordance. Footer mono caption: "Integrations arrive in Phase 1B." (Per spec §6.1/§6.7 — this is the empty scaffold; wiring is 1B.)
- Verify: `pnpm tsc --noEmit`. Commit: `feat: build Settings page — profile/appearance/connections (1A.5)`.

---

## Wave 2 — Verify + acceptance

### Task 7: e2e for new unauth surfaces
- Files: Create `tests/e2e/secondary-pages.spec.ts` (**repo-root `tests/e2e`** — `playwright.config.ts` sets `testDir: "./tests/e2e"`; a file under `src/tests/e2e` would be silently ignored). Match `tests/e2e/skeleton.spec.ts` style — `*.spec.ts`, named imports, baseURL-relative `page.goto`.
- [ ] Test that `/settings` redirects unauthenticated → `/login` (it's a new session-gated route): `await page.goto("/settings"); await expect(page).toHaveURL(/\/login/);`. Add the same assertion for `/journal` and `/social` (the routes not already covered in `skeleton.spec.ts`). These are the only assertions possible without a session.
- [ ] Commit: `test: unauth redirects for /settings + secondary pages (1A.5)`.

### Task 8: Full verify gate

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit          # 0 errors
pnpm lint                  # 0 errors
pnpm build                 # 0 errors (catches client/server boundary + Suspense issues)
PORT=3009 BASE_URL=http://localhost:3009 pnpm test:e2e   # all pass
```

- [ ] @superpowers:verification-before-completion applies — verify by running, not asserting.
- [ ] Run a `code-reviewer` agent over the slice diff (focus: write-path security on `updateProfile` — RLS/`user_id`/PK correctness; read correctness; design fidelity vs prototype; a11y baseline; honest empty states vs fabricated data). Address Should-fix items; re-run the gate.
- [ ] **Manual seam (Max):** authenticated flows can't be e2e-tested (magic-link, no session seam). After merge, Max signs in and confirms: each secondary page renders his real data (or clean empty states); Settings → edit profile name/role/location/focus → Save → reload → persists, and the dashboard operator card reflects it; the avatar + quick-switch reach Settings. This is the real acceptance.

---

## Definition of Done (1A.5)

1. `/finance`, `/health`, `/train`, `/social`, `/journal` render full design-faithful read views of the operator's real data, with honest `EmptyState`s wherever data is absent (no fabricated numbers).
2. `/settings` exists: profile edit via the Zod-validated `updateProfile` server action (single write path, RLS-protected), a dark-only theme switcher (Cream/Warm disabled, labeled Phase 3 — no live theming wired), and an empty Connections placeholder for the four Phase-1B providers.
3. Settings is reachable from the operator avatar (web + mobile) and the web Quick Switch; the top nav stays at 6 tabs.
4. New shared primitives (`PageHeader`, `Sparkbars`, `StatRow`, `KpiRow`, `StatCell`) are reused across pages — no per-page duplication of those patterns.
5. `tsc`/`lint`/`build` clean; Playwright green (incl. new unauth-redirect specs); code-reviewed; **no new dependencies**.

**On completion:** Plan 1A.6 adds the PWA layer (manifest, app icons via `next/og`, theme-color/apple-web-app metadata, the middleware manifest exclusion, a one-time iOS `<InstallPrompt>`) and walks the spec §7 Phase 1A acceptance gate, targeting Lighthouse PWA ≥90.
