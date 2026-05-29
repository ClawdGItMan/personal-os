# Personal OS — Plan 1A.3: App Skeleton & Chrome

> **For agentic workers:** This plan is executed **inline** by the lead agent (not a parallel subagent wave). Rationale: the skeleton is a tightly interdependent unit (primitives → chrome → shells → pages) that heavily edits shared files (`globals.css`, the new `(app)/layout.tsx`). Per the hard-won 1A.2 lesson, shared-file-heavy work is the *worst* candidate for parallel agents in one tree. Parallelism is saved for Plan 1A.4 (independent module cards). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the real app shell — web 3-zone layout, mobile single-column + bottom-tab layout, viewport switching, the TopBar with a live clock, and every dashboard module rendered as a labeled `NN //` card (empty states for now) — so the next slice can fill cards with real data and manual entry.

**Architecture:** A server `(app)/layout.tsx` fetches the operator profile once and hands it to a client `AppShell` that picks `WebLayout` vs `MobileLayout` via `matchMedia('(min-width:1024px)')`, defaulting to mobile on the server (smaller mobile payload; hydration swaps to web on desktop — per spec §5.2). Nav tabs are real Next `<Link>`s; active state comes from `usePathname()` (the Next-idiomatic version of the prototype's client-state nav). All visual primitives are hand-rolled to match `design_handoff_personal_os/` exactly. Dark theme only (spec §5.3 defers Cream/Warm to Phase 3).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (existing `@theme` tokens), TypeScript strict. **No new dependencies.**

**Spec reference:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` §5.1 (routing), §5.2 (layout switching), §5.5 (component composition). Design source: `design_handoff_personal_os/prototype/app/{web-main,mobile-main,components-shared,components-modules}.jsx`.

---

## Design facts (from prototype analysis — authoritative)

- **Web 3-zone grid:** left context rail (~280px) │ center workspace (1fr) │ right agent rail (~340px).
- **Web TopBar:** brand (glowing sage dot + `MAX OS` + `// V0`) · 6 nav tabs (HOME/FINANCE/HEALTH/TRAIN/SOCIAL/JOURNAL) · right cluster (date `MMM DD, YYYY` uppercased + **24h** live clock `HH:MM` + `MA` avatar). (Export/Demo chips from prototype are omitted — non-functional decoration.)
- **Mobile:** slim top bar (brand + clock) · single scrolling column · glassy bottom nav with **4 tabs**: Home / Money / Body / Agent.
- **`NN //` card header:** two-digit number in mono 10px at `--os-fg-5`, `//`, TITLE mono 11px ALL CAPS tracked `0.18em` at `--os-fg-3`, right-aligned META mono 10px at `--os-fg-4`. Card hover lifts border `line-1 → line-2`.
- **Live clock:** 44px mono tabular-nums, **blinking colon** (steps animation); seconds smaller + dimmer. Top-bar clock is minute-granularity.
- **Module set (home):** left rail = Operator, FinancePulse, Tasks · center = Session (greeting+clock+capture), Habits, Calendar, [Nutrition · Health · Social] row, Train · right = Agent panel.
- **Borders OR shadows never both; hairlines are alpha-cocoa not grey; no emoji in chrome; motion 160–220ms `--ease-standard`.**
- **Module count caveat:** design defines 11 numbered modules (01–11). "12 Inbox" is a spec addition with no prototype; built as a simple thread-list card, empty until Gmail (1B).

---

## File Structure (after this plan)

```
src/
├── app/
│   ├── globals.css                        [MODIFY — add keyframes + chrome helpers]
│   └── (app)/
│       ├── layout.tsx                      [CREATE — server: fetch profile → AppShell]
│       ├── dashboard/page.tsx              [MODIFY — home module stack]
│       ├── finance/page.tsx                [CREATE — placeholder page]
│       ├── health/page.tsx                 [CREATE — placeholder]
│       ├── train/page.tsx                  [CREATE — placeholder]
│       ├── social/page.tsx                 [CREATE — placeholder]
│       ├── journal/page.tsx                [CREATE — placeholder]
│       └── agent/page.tsx                  [CREATE — mobile agent placeholder]
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx                     [CREATE — client viewport switch]
│   │   ├── WebLayout.tsx                    [CREATE — 3-zone grid]
│   │   ├── MobileLayout.tsx                 [CREATE — single col + bottom nav]
│   │   ├── TopBar.tsx                       [CREATE — client: brand/tabs/clock/avatar]
│   │   ├── MobileTopBar.tsx                 [CREATE — client: brand + clock]
│   │   ├── BottomNav.tsx                    [CREATE — client: 4 tabs]
│   │   ├── LeftRail.tsx                     [CREATE — client: operator + quickswitch/finance + tasks]
│   │   └── AgentRail.tsx                    [CREATE — agent placeholder]
│   ├── primitives/
│   │   ├── Card.tsx                         [CREATE — NN// header card]
│   │   ├── Sparkline.tsx                    [CREATE — SVG area+line]
│   │   ├── Modal.tsx                        [CREATE — scrim dialog (used in 1A.4)]
│   │   └── EmptyState.tsx                   [CREATE — mono empty caption]
│   └── modules/
│       ├── OperatorCard.tsx                 [CREATE — real profile data]
│       ├── SessionCard.tsx                  [CREATE — client: greeting+clock+capture visual]
│       ├── FinancePulseCard.tsx             [CREATE — placeholder]
│       ├── TasksCard.tsx                    [CREATE — placeholder]
│       ├── HabitsCard.tsx                   [CREATE — placeholder]
│       ├── CalendarCard.tsx                 [CREATE — placeholder]
│       ├── NutritionCard.tsx                [CREATE — placeholder]
│       ├── HealthCard.tsx                   [CREATE — placeholder]
│       ├── SocialCard.tsx                   [CREATE — placeholder]
│       ├── TrainCard.tsx                    [CREATE — placeholder]
│       └── InboxCard.tsx                    [CREATE — placeholder]
├── lib/
│   ├── hooks/useClock.ts                    [CREATE]
│   ├── format.ts                            [CREATE — fmtUSD/fmtPct/greeting]
│   └── nav.ts                               [CREATE — web + mobile tab config]
└── tests/e2e/skeleton.spec.ts               [CREATE — chrome + nav render]
```

---

## Conventions (carry from existing code)

- Supabase server client: `import { createClient } from "@/lib/supabase/server"` then `await createClient()`. Client: `@/lib/supabase/client`.
- Tokens via raw CSS vars (`text-[color:var(--os-fg-3)]`) OR utilities (`text-os-fg-3`, `font-display`, `font-mono`, `rounded-os-card`) — both work. Glow/soft/dim variants + shadows + `--text-*`/`--s-*`/`--ease-*` exist only as raw vars.
- `"use client"` only where hooks/interactivity are used (clock, pathname, matchMedia). Layouts/pages/cards default to Server Components.
- Path alias `@/*` → `src/*`. Strict TS + `noUncheckedIndexedAccess`.
- Components < 150 lines; extract if larger.

---

## Wave 1 — Foundation (globals + lib + primitives)

### Task 1: globals.css animation/keyframe additions

**Files:** Modify `src/app/globals.css` (append after the base block; do NOT touch the token/`@theme` blocks).

- [ ] Append keyframes + helpers:

```css
/* ============================================================
   ANIMATIONS / CHROME HELPERS (Plan 1A.3)
   ============================================================ */
@keyframes os-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
@keyframes os-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes os-entrance { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes os-typing { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }

.os-pulse { animation: os-pulse 2.5s var(--ease-standard) infinite; }
.os-blink { animation: os-blink 1s steps(2, start) infinite; }
.os-entrance { animation: os-entrance var(--dur-base) var(--ease-entrance) both; }

/* live dot with sage glow */
.os-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--os-accent);
  box-shadow: 0 0 6px var(--os-accent-glow);
}

/* card hover hairline lift */
.os-card-hover { transition: border-color var(--dur-fast) var(--ease-standard); }
.os-card-hover:hover { border-color: var(--os-line-2); }

/* tabular numerals for clocks/KPIs */
.os-tnum { font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

@media (prefers-reduced-motion: reduce) {
  .os-pulse, .os-blink, .os-entrance { animation: none; }
}
```

- [ ] Verify: `pnpm tsc --noEmit` (CSS doesn't affect tsc, but confirm no syntax break in build later). Commit: `feat: add chrome keyframes and animation helpers (1A.3)`.

### Task 2: lib utilities

**Files:** Create `src/lib/hooks/useClock.ts`, `src/lib/format.ts`, `src/lib/nav.ts`.

- [ ] `src/lib/hooks/useClock.ts` — ticking clock, mount-gated to avoid hydration mismatch:

```ts
"use client";
import { useEffect, useState } from "react";

/** Returns the current Date, ticking every second. Null until mounted (avoids SSR hydration mismatch). */
export function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
```

- [ ] `src/lib/format.ts`:

```ts
export function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
export function fmtUSDDelta(n: number): string {
  const s = fmtUSD(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}
export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
export function fmtClock(d: Date): { hhmm: string; ss: string } {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return { hhmm: `${hh}:${mm}`, ss };
}
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
}
```

- [ ] `src/lib/nav.ts`:

```ts
export type NavTab = { label: string; href: string; mobileLabel?: string; icon?: string };

export const WEB_TABS: NavTab[] = [
  { label: "HOME", href: "/dashboard" },
  { label: "FINANCE", href: "/finance" },
  { label: "HEALTH", href: "/health" },
  { label: "TRAIN", href: "/train" },
  { label: "SOCIAL", href: "/social" },
  { label: "JOURNAL", href: "/journal" },
];

export const MOBILE_TABS: NavTab[] = [
  { label: "HOME", mobileLabel: "Home", href: "/dashboard", icon: "◉" },
  { label: "FINANCE", mobileLabel: "Money", href: "/finance", icon: "$" },
  { label: "HEALTH", mobileLabel: "Body", href: "/health", icon: "♡" },
  { label: "AGENT", mobileLabel: "Agent", href: "/agent", icon: "✦" },
];
```

- [ ] Commit: `feat: add useClock hook, format helpers, nav config (1A.3)`.

### Task 3: primitives (Card, Sparkline, EmptyState, Modal)

**Files:** Create the four `src/components/primitives/*.tsx`.

- [ ] `Card.tsx` — the signature `NN //` instrument-panel container:

```tsx
import type { ReactNode } from "react";

type CardProps = {
  num?: string;          // "01"
  title?: string;        // "OPERATOR"
  meta?: ReactNode;      // right-aligned mono caption
  children?: ReactNode;
  className?: string;
  noPad?: boolean;
};

export function Card({ num, title, meta, children, className = "", noPad = false }: CardProps) {
  return (
    <section
      className={`os-card-hover os-entrance bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-1)] rounded-os-card ${noPad ? "" : "p-4"} ${className}`}
    >
      {(num || title || meta) && (
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 font-mono">
            {num && <span className="text-[10px] text-[color:var(--os-fg-5)]">{num}</span>}
            {num && <span className="text-[10px] text-[color:var(--os-fg-5)]">//</span>}
            {title && (
              <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-fg-3)]">{title}</span>
            )}
          </div>
          {meta && <div className="font-mono text-[10px] text-[color:var(--os-fg-4)]">{meta}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] `EmptyState.tsx`:

```tsx
export function EmptyState({ caption }: { caption: string }) {
  return (
    <div className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
      {caption}
    </div>
  );
}
```

- [ ] `Sparkline.tsx` — ported from prototype (SVG area+line, end dot+glow):

```tsx
type SparklineProps = { data: number[]; height?: number; color?: string };

export function Sparkline({ data, height = 64, color = "var(--os-accent)" }: SparklineProps) {
  if (data.length < 2) return <div style={{ height }} />;
  const w = 240;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / span) * height;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const last = pts[pts.length - 1]!;
  const gid = `sg-${data.length}-${Math.round(min)}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}
```

- [ ] `Modal.tsx` — scrim + dialog (used by 1A.4 entry forms; ship now so the primitive exists):

```tsx
"use client";
import { useEffect, type ReactNode } from "react";

type ModalProps = { open: boolean; onClose: () => void; title?: string; children: ReactNode };

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-card p-5 shadow-[var(--shadow-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--os-fg-3)]">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-1)]">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
```

- [ ] Verify: `pnpm tsc --noEmit` (expect 0). Commit: `feat: add Card, Sparkline, Modal, EmptyState primitives (1A.3)`.

---

## Wave 2 — Chrome + shells

### Task 4: TopBar, MobileTopBar, BottomNav

**Files:** Create `src/components/shell/{TopBar,MobileTopBar,BottomNav}.tsx`.

- [ ] `TopBar.tsx` (client) — brand · 6 tabs (active via `usePathname`) · date + 24h clock + `MA` avatar. Clock from `useClock()`; render clock text only when `now` is non-null (mount-gated). Colon between HH and MM wrapped in `<span className="os-blink">`. Initials from operator prop (fallback `MA`).
- [ ] `BottomNav.tsx` (client) — 4 `MOBILE_TABS` as `<Link>`s, icon over label, active via `usePathname`; fixed bottom, `backdrop-filter: blur(20px)`, safe-area bottom padding (`pb-[24px]`).
- [ ] `MobileTopBar.tsx` (client) — brand dot + `MAX OS` + minute clock.
- [ ] Verify `pnpm tsc --noEmit`. Commit: `feat: add TopBar, MobileTopBar, BottomNav (1A.3)`.

### Task 5: LeftRail + AgentRail

**Files:** Create `src/components/shell/{LeftRail,AgentRail}.tsx`.

- [ ] `LeftRail.tsx` (client, reads `usePathname`): renders `<OperatorCard operator={...} />`, then on `/dashboard` → `<FinancePulseCard />` else a **Quick Switch** `Card` (num `//`, title `QUICK SWITCH`, list of `WEB_TABS` as links), then `<TasksCard />`. Operator passed as prop from the server layout.
- [ ] `AgentRail.tsx`: `Card`-less full-height panel matching the agent chrome — header `11 // AGENT`, a `CONNECTED`-style pill reading `PHASE 2`, subtitle `↗ TELEGRAM · not yet wired`, a calm empty body (`<EmptyState caption="Agent arrives in Phase 2" />`), and a **disabled** compose bar (visual only). No live behavior.
- [ ] Verify. Commit: `feat: add LeftRail and AgentRail placeholder (1A.3)`.

### Task 6: WebLayout, MobileLayout, AppShell

**Files:** Create `src/components/shell/{WebLayout,MobileLayout,AppShell}.tsx`.

- [ ] `WebLayout.tsx` — 3-zone grid:

```tsx
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { LeftRail } from "./LeftRail";
import { AgentRail } from "./AgentRail";
import type { Operator } from "@/lib/types";

export function WebLayout({ operator, children }: { operator: Operator; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--os-bg)]">
      <TopBar operator={operator} />
      <main className="grid gap-3 px-3 pb-6" style={{ gridTemplateColumns: "280px 1fr 340px" }}>
        <aside className="flex flex-col gap-3 pt-3"><LeftRail operator={operator} /></aside>
        <section className="flex flex-col gap-3 pt-3 min-w-0">{children}</section>
        <aside className="pt-3"><AgentRail /></aside>
      </main>
    </div>
  );
}
```

- [ ] `MobileLayout.tsx` — slim top bar + single scroll column (pad-bottom 100px for nav) + `BottomNav`.
- [ ] `AppShell.tsx` (client) — viewport switch (SSR default mobile; swap to web post-mount):

```tsx
"use client";
import { useEffect, useState, type ReactNode } from "react";

export function AppShell({ web, mobile }: { web: ReactNode; mobile: ReactNode }) {
  const [isWeb, setIsWeb] = useState(false); // SSR + first client render = mobile (no mismatch)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWeb(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return <>{isWeb ? web : mobile}</>;
}
```

- [ ] Add `src/lib/types.ts` with the `Operator` type (derived from `profiles` row + sensible fallbacks: `name, initials, role, location, focus, streak, timezone`).
- [ ] Verify `pnpm tsc --noEmit`. Commit: `feat: add WebLayout, MobileLayout, AppShell viewport switch (1A.3)`.

---

## Wave 3 — Module cards (placeholders) + app layout + pages

### Task 7: module cards

**Files:** Create all `src/components/modules/*.tsx`.

- [ ] `OperatorCard.tsx` (server-friendly, takes `operator` prop) — `01 // OPERATOR`, avatar initials, `name` (Newsreader, name italic), `role · location`, `FOCUS` line, `streak` + `ONLINE` dot. Real data from props.
- [ ] `SessionCard.tsx` (client) — `02 // SESSION`. Greeting (`greeting(now)` + operator first name italic in Newsreader), the 44px live clock with blinking colon + smaller dim seconds, date + timezone, and the **capture bar** (input + sage send button, `:focus-within` ring) — *visual only* this slice (no submit wiring; placeholder `onSubmit` prevents default). Mount-gate clock text.
- [ ] Remaining cards as **header + empty state** placeholders, each its own file so 1A.4 agents own them cleanly:
  - `FinancePulseCard` → `03 // FINANCE PULSE`, meta `30D`, `EmptyState "No accounts yet"`.
  - `TasksCard` → `04 // TODAY · KEY`, meta `0 DUE`, `EmptyState "No tasks yet"`.
  - `HabitsCard` → `05 // HABITS`, meta `0/0`, `EmptyState "No habits yet"`.
  - `CalendarCard` → `06 // CALENDAR`, meta month, `EmptyState "No events"`.
  - `NutritionCard` → `07 // NUTRITION`, `EmptyState "No meals logged"`.
  - `HealthCard` → `08 // HEALTH`, `EmptyState "No health data"`.
  - `SocialCard` → `09 // SOCIAL`, `EmptyState "No followers tracked"`.
  - `TrainCard` → `10 // TRAINING`, `EmptyState "No sessions"`.
  - `InboxCard` → `12 // INBOX`, `EmptyState "Connect Gmail in 1B"`.
- [ ] Verify `pnpm tsc --noEmit`. Commit: `feat: add module cards with empty states (1A.3)`.

### Task 8: app layout + dashboard + secondary pages

**Files:** Create `src/app/(app)/layout.tsx`, modify `dashboard/page.tsx`, create `finance|health|train|social|journal|agent/page.tsx`.

- [ ] `(app)/layout.tsx` (server): `getUser()` → redirect `/login` if absent (defense in depth; middleware already guards). Fetch `profiles` row → build `Operator` (fallbacks for null fields). Render:

```tsx
<AppShell
  web={<WebLayout operator={op}>{children}</WebLayout>}
  mobile={<MobileLayout operator={op}>{children}</MobileLayout>}
/>
```

- [ ] `dashboard/page.tsx` — home center stack: `SessionCard`, `HabitsCard`, `CalendarCard`, a 3-col `.row` (`NutritionCard`/`HealthCard`/`SocialCard`), `TrainCard`, `InboxCard`. (Operator/Finance/Tasks live in the left rail via the layout.) Pass operator down for SessionCard greeting (read from a server prop or fetch again — prefer passing via the layout if simple; otherwise re-fetch in page).
- [ ] `finance|health|train|social|journal/page.tsx` — each a single `Card` with the page's `NN //` header + `EmptyState "Full page lands in 1A.5"`. (These become real in 1A.5.)
- [ ] `agent/page.tsx` — renders `<AgentRail />` full-width (mobile agent tab destination).
- [ ] Verify `pnpm tsc --noEmit` + `pnpm lint`. Commit: `feat: wire app layout, dashboard, and secondary placeholder pages (1A.3)`.

---

## Wave 4 — Verify + acceptance

### Task 9: E2E + full verification

**Files:** Create `tests/e2e/skeleton.spec.ts`.

@superpowers:verification-before-completion applies — verify by running, not asserting.

- [ ] `skeleton.spec.ts` — without a real session we can only assert the unauthenticated redirect still holds and the login chrome renders; add an assertion that `/dashboard` while unauthenticated redirects to `/login` (confirms the new `(app)/layout` guard + middleware compose correctly). Keep existing `first-signin.spec.ts` green.
- [ ] Run full gate:

```bash
cd "/Users/me/Projects/Personal OS"
pnpm tsc --noEmit          # 0 errors
pnpm lint                  # 0 errors
pnpm build                 # 0 errors (catches Suspense/client-boundary issues)
PORT=3005 BASE_URL=http://localhost:3005 pnpm exec playwright test --reporter=line   # all pass
```

- [ ] **Visual smoke (manual seam, lead agent drives via dev server):** start dev on 3005, confirm `/login` renders; (authenticated visual check of `/dashboard` web 3-zone + mobile happens when Max signs in — note for him).
- [ ] Commit any test additions: `test: add skeleton nav/redirect e2e (1A.3)`.

---

## Definition of Done (1A.3)

1. `(app)/layout.tsx` renders `AppShell` → web 3-zone (280│1fr│340) on ≥1024px, mobile single-column + 4-tab bottom nav below.
2. TopBar shows brand, 6 routing tabs (active state correct), 24h live clock with blinking colon, date, `MA` avatar.
3. All home modules render as `NN //` cards with empty states; Operator + Session show real profile/clock; Agent rail shows the Phase-2 placeholder.
4. 6 web tabs + 4 mobile tabs route to their pages; secondary pages render placeholders.
5. `tsc` 0, `lint` 0, `build` 0, Playwright all green.
6. No new dependencies added; dark theme only.
7. Clean conventional-commit history.

**On completion:** Plan 1A.4 installs `swr` + `zod` (serialized) and fans out parallel **worktree** agents — one per module — to replace each card's empty state with real data + a Zod-validated, RLS-protected manual-entry server action (the single write path).
