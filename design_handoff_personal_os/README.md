# Handoff: Personal OS (Max OS)

A personal operating system for one user — finances, health, training, calendar,
social, journal, and a Telegram-fed agent that triages everything. Built as a
dark "operator console" with mono labels, numbered modules, sage-green accents
on a deep slate-cocoa canvas.

---

## About the design files

The files in this bundle are **design references created in HTML/JSX (React +
inline Babel)** — interactive prototypes showing the intended look and behavior,
**not production code to ship directly**.

Your task is to **recreate these prototypes in a real codebase** using its
established patterns. If there's no codebase yet, pick the stack — I'd recommend:

- **Web:** Next.js (App Router) + TypeScript + Tailwind CSS + Radix UI primitives,
  or your existing component library. Server actions for Telegram webhook
  ingress, Postgres (Supabase / Neon) for the data layer.
- **Mobile:** React Native + Expo, or native (SwiftUI / Kotlin) if performance
  on health-device integrations matters.
- **Agent:** an LLM with tool-calling, a webhook for Telegram, and a small set
  of typed tools wrapping the data layer (one per module).

Either way: do **not** translate the prototype's CSS literally. Lift the tokens,
the layout structure, the component composition, and the copy — then reimplement
in idiomatic code for your stack.

## Fidelity

**High-fidelity.** Exact colors, typography, spacing, motion durations, and
copy are all specified below and embedded in `app.css`. Treat them as binding.

The prototype uses HTML's CSS custom properties as design tokens; the same
tokens should be the basis of your design system (Tailwind config, CSS-in-JS
theme, design tokens JSON, etc.).

---

## Product overview

**Operator:** Max Allaire, NYC, founder hunting an idea.

**Modules on the dashboard (in numbered order):**

| # | Module | What it does |
|---|---|---|
| 01 | OPERATOR | Identity card — name, role, location, focus, streak |
| 02 | SESSION | Greeting, live clock, **capture bar** (the spine — typed input goes straight to the agent) |
| 03 | FINANCE PULSE | Net worth, 30D change, sparkline, daily/monthly delta |
| 04 | TODAY · KEY | Today's high-priority tasks (toggleable) |
| 05 | HABITS | Daily score, sparkline, 6-cell habit grid (toggleable) |
| 06 | CALENDAR | Today's events grouped by morning/now/evening + 7-day week strip |
| 07 | NUTRITION | kcal ring, macros (P/C/F), meals (compact) |
| 08 | HEALTH | Sleep score, recovery ring, HRV/RHR/strain (compact) |
| 09 | SOCIAL | Follower total, 26-day sparkbar, per-platform breakdown |
| 10 | TRAINING | Today's split, next session, recent PR, weekly volume |
| 11 | AGENT | Right-rail chat panel — Telegram-fed; agent replies inline |

**Secondary pages** (full canvas takeover when nav tab clicked):
- `FINANCE` — accounts list, allocation bars, weekly cash flow
- `HEALTH`  — recovery/sleep/strain rings, HRV/weight/steps sparks, biomarkers
- `TRAIN`   — current session lift table, 8-week volume bars, weekly split
- `SOCIAL`  — 30D growth bars, per-platform table
- `JOURNAL` — chronological brain dumps in serif body type

**Mobile companion** (`app/mobile.html`):
- 4 bottom tabs: Home / Money / Body / Agent
- Same vocabulary, single-column, capture bar at top of Home

---

## Visual system

### Theme — three palettes, one shape

Tweakable in the prototype via the Tweaks panel. Default is **Dark**.

| Theme | Background | Accent | When to use |
|---|---|---|---|
| **Dark** (default) | `#0E1014` | `#8FA67A` sage | Operator console feel |
| **Cream** | `#F7F2E8` | `#5E7A4D` sage | Hearth-faithful, daytime |
| **Warm** | `#1A1410` | `#ED9569` ember | Deep cocoa, evening |

All three are defined as CSS variables in `app.css` under `:root` and the
`[data-theme="light"]` / `[data-theme="hybrid"]` selectors. Implement as theme
contexts or `data-theme` attribute on the document.

### Color tokens (dark theme)

```
--os-bg:        #0E1014   /* canvas */
--os-bg-2:      #14171C   /* card */
--os-bg-3:      #1A1E24   /* raised */
--os-bg-hover:  #1F242B
--os-bg-sunk:   #0A0C10

--os-fg-1:      #F2EEE6                          /* primary text */
--os-fg-2:      rgba(242, 238, 230, 0.72)        /* body */
--os-fg-3:      rgba(242, 238, 230, 0.52)        /* secondary */
--os-fg-4:      rgba(242, 238, 230, 0.36)        /* mono captions */
--os-fg-5:      rgba(242, 238, 230, 0.20)        /* placeholder */

--os-line-1:    rgba(242, 238, 230, 0.06)        /* hairlines */
--os-line-2:    rgba(242, 238, 230, 0.10)        /* default */
--os-line-3:    rgba(242, 238, 230, 0.16)        /* strong */

--os-accent:        #8FA67A                      /* sage — primary */
--os-accent-soft:   rgba(143, 166, 122, 0.14)
--os-accent-glow:   rgba(143, 166, 122, 0.30)
--os-accent-dim:    rgba(143, 166, 122, 0.55)

--os-ember:         #E07856                      /* secondary highlight */
--os-honey:         #F4B860                      /* warm flag */
--os-rust:          #C25D3F                      /* warn / overdue */
```

The full set of tokens (including spacing, radii, shadow, motion) lives in
`hearth.css` — that's the upstream Hearth Design System this builds on.

### Typography

Three families, all from Google Fonts:

```
--font-display: "Newsreader", "Iowan Old Style", Georgia, serif;   /* greetings, page titles */
--font-body:    "Manrope", system-ui, sans-serif;                  /* body, buttons */
--font-mono:    "JetBrains Mono", ui-monospace, monospace;         /* labels, numbers */
```

Scale:
```
--text-xs:   12px
--text-sm:   13px
--text-base: 15px
--text-md:   17px
--text-lg:   20px
--text-xl:   24px
--text-2xl:  32px
--text-3xl:  44px
--text-4xl:  60px
--text-5xl:  84px
```

**Rules:**
- **Mono labels** are ALL CAPS, tracked `0.16em`, size 11px, color `--os-fg-3` or `--os-fg-4`. Use on every card header, kpi label, eyebrow.
- **Numbers** (net worth, kcal, weight) are mono, tabular-nums, slightly negative letter-spacing.
- **Greetings & page titles** are Newsreader with optical sizing, italic for the *name* token (`Good evening, *Max.*`).
- **Body** is Manrope 400 / 500. No 700 in chrome.
- **No emoji** in product copy. Allowed: `·` separator, `↑↓→` arrows, `✓` checks, `★`.

### Spacing & radii

4px grid: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`.

Radii increase with element size:
- inputs/chips: `10px`
- cards: `14px`
- pills (status badges, segmented controls): `999px`

### Motion

```
--ease-standard: cubic-bezier(0.32, 0.72, 0, 1)
--ease-entrance: cubic-bezier(0.16, 1, 0.3, 1)
--dur-fast:    160ms
--dur-base:    220ms
```

Use 160–220ms fades / cross-fades with a 4px Y translate. Pulse for live
indicators (online dot, NOW marker), blink for the clock colon. No bouncy
modals, no confetti.

### Borders, shadows, blur

- **Hairlines** at `rgba(242, 238, 230, 0.06–0.16)` (alpha cocoa tint, never grey).
- **Use borders OR shadow, not both.** Cards on canvas: hairline border, no
  shadow. Modals: shadow only.
- **Backdrop blur** only on overlays/modals: `backdrop-filter: blur(8–20px)`.

---

## Layout

### Web — three-zone grid

```
┌───────────────────────────────────────────────────────────────┐
│  Top bar (44px)  · MAX OS · tabs · clock · me                 │
├──────────┬────────────────────────────────────┬───────────────┤
│          │                                    │               │
│ Left col │   Center canvas                    │  Agent panel  │
│ 280px    │   flexible                         │  340px        │
│          │                                    │               │
│ Operator │   Session (hero, 220px min)        │  Header       │
│ Finance  │   Habits                           │  ─────        │
│ Tasks    │   Calendar                         │  Chat scroll  │
│          │   3-up: Nutrition · Health · Social│               │
│          │   Training                         │  Compose bar  │
│          │                                    │               │
└──────────┴────────────────────────────────────┴───────────────┘
```

- Three columns: `280px | 1fr | 340px`
- Card-to-card gap inside columns: `12px`
- Column padding: `14px`
- Right column has its own `border-left: 1px solid --os-line-1`, no padding
  (the AgentPanel handles its own internal padding)

### Mobile

- Single column, 16px gutters, 100px bottom padding (clears the nav bar)
- Top bar: 44px, brand + clock
- Bottom tab bar: 4 tabs (Home / Money / Body / Agent), absolute-positioned
- Cards: `border-radius: 14px`, `padding: 14px`, hairline border, no shadow

---

## Key components

### Top bar (`TopBar` in `components-shared.jsx`)

- Brand "MAX OS · V0" left with a pulsing sage dot
- Tab row, each tab is a mono uppercase label inside a thin-bordered box
- Active tab: white text, white underline, slightly elevated background
- Right cluster: EXPORT button, DEMO ON pill (ember when active), date, time, MA avatar
- Time updates every second; date is locale-formatted month/day/year

### Session card (`SessionCard`)

- Time-aware greeting: "Good morning / afternoon / evening / Late night / Still up"
- Italic *name* token rendered in Newsreader
- Live clock to the right, 44px mono with a blinking colon, seconds in a smaller weight
- Capture bar full-width below: `⌘K` chip, placeholder, sage Capture button
- Submitting the bar pushes a `{role: "you", source: "WEB CAPTURE"}` message
  into the Agent panel
- Subtle grid background pattern in the card via dual-direction linear-gradients
  with a radial mask

### Card (`Card`)

Every module sits inside this:
```
┌──────────────────────────────────────┐
│ NN //  TITLE                  META   │  ← head
│                                      │
│  [body]                              │
└──────────────────────────────────────┘
```
- `NN //` is mono 10px, color `--os-fg-5`
- TITLE is mono 11px, tracked `0.18em`, color `--os-fg-3`
- META is right-aligned, mono 10px, color `--os-fg-4`
- Hover: border lifts from `--os-line-1` to `--os-line-2`

### Agent panel (`AgentPanel` in `agent.jsx`)

The product spine.

- Header: `11 // AGENT` + "CONNECTED" pulse, sub-line `↗ TELEGRAM @maxOS_bot · Always listening`
- Scrollable message list
- Each message:
  - Meta line: `YOU · 06:48 · TELEGRAM` (or `AGENT · 08:13 · MAX OS`)
  - Bubble: 13px text, 10px line-height 1.4, padding 10/12
  - YOU bubble aligns right, sage-tinted background + dim border
  - AGENT bubble aligns left, `--os-bg-2` background, hairline border
  - Optional action chips below the bubble (sage / ember / honey / neutral)
- Typing indicator: 3 sage dots with staggered animation while the agent "thinks"
- Compose bar at bottom: same shape as the Session capture bar
- Below compose: 3 suggestion pills + "↩ to send · ⌥↩ for newline" / `● TG SYNCED` meta

**Agent reply behavior:**
Currently heuristic regex match on input → canned reply. See `CANNED_REPLIES`
in `app/agent.jsx`. **In production, replace with an LLM** (Anthropic Claude,
Haiku for cheap turns) tool-calling into:
- `logWeight(value, unit)`
- `logMeal(text)` → returns kcal/macro estimate
- `logLift(name, weight, reps)` → returns PR detection
- `addTask(title, tags, priority)`
- `addCalendarEvent(time, title)`
- `logInvestment(name, amount, type)`
- `pullCRMCandidates(topic)` → returns suggested contacts
- `summarizeDay()` / `summarizeWeek()`

### Finance Pulse + sparkline

- Net worth in mono 32px tabular-nums
- 30D change pill: sage-tinted, mono caps, has up/down arrow + percentage
- SVG sparkline below: line + gradient area fill, dot + glow at the last point
- 2-up grid below: Daily delta + Monthly delta, each a sage value in a raised cell

### Habits

- 48px circular score badge (count of done habits)
- 48-pip random-height "EQ bar" beside it, filled proportionally
- 3×2 grid of habit cards. Each card: checkbox + name + mono sub-label + streak `♨ 28` in the top-right
- Done state: sage-tinted background, sage checkmark

### Calendar

- 7-day week strip across the top, each day a small button (border + dot when has events)
- Vertical event list grouped by section labels ("MORNING / NOW · 14:32 / EVENING")
- "NOW" section label is sage with a gradient bar
- Each event: `time | title + sub | location-mono`
- Hover lifts background

### Mobile bottom nav

```
┌───────────────────────────────────────────┐
│  ◉ Home   $ Money   ♡ Body   ✦ Agent      │
└───────────────────────────────────────────┘
```
Position: absolute bottom, 12/24px padding, backdrop blur, hairline top border.
Active tab is full opacity `--os-fg-1`; inactive is `--os-fg-4`.

---

## Interactions

| Where | Action | Result |
|---|---|---|
| Top bar tab | click | swap center column to that page; sticky left rail rebuilds with quick-switch |
| Habit cell | click | toggle done; sage-tint applies; score badge updates |
| Task row | click | toggle done; strikethrough text fade |
| Session capture | submit | append `{you, WEB CAPTURE}` to agent thread; clear input |
| Agent compose | submit | append user msg; 0.9–1.6s later append heuristic reply + chips |
| Agent suggestion pill | click | acts as if user typed that suggestion |
| Tweaks panel | toggled by host toolbar | live theme/typography/density switch |
| Modal | Esc / click scrim | dismiss |

All transitions are `160–220ms cubic-bezier(0.32, 0.72, 0, 1)`. No spring, no
overshoot in standard UI.

---

## Data model (suggested)

```ts
// Aspirational schema — see app/data.js for concrete values

type Operator = {
  name: string; last: string; initials: string;
  role: string; location: string;
  focus: string; streak: number;
  timezone: string;
};

type Finance = {
  netWorth: number;
  change30d: number;     // percent
  daily: number;         // $
  dailyPct: number;
  monthly: number;
  monthlyPct: number;
  spark: number[];       // 28 daily points
  accounts: Array<{ name: string; type: "BANK"|"HYSA"|"EQUITY"|"RETIRE"|"CRYPTO"|"PRIVATE"|"T-BILLS"; value: number; delta: string }>;
};

type Task = { id: number; title: string; tags: string[]; star: boolean; done: boolean };

type Habit = { id: string; name: string; sub: string; done: boolean; streak: number };

type CalendarEvent = {
  section?: "MORNING"|"EVENING"|`NOW · ${string}`|null;
  time: string;       // "08:30 –\n09:30" or "07:00"
  title: string;
  sub: string;        // mono caps
  loc: string;        // mono caps
  now?: boolean;
};

type AgentMessage = {
  id: number;
  role: "you"|"agent";
  time: string;        // "13:08"
  source: "TELEGRAM"|"MAX OS"|"WEB CAPTURE"|"MOBILE";
  text: string;
  chips?: Array<{ label: string; kind: ""|"sage"|"ember"|"honey" }>;
};
```

Full sample data is in `app/data.js`.

---

## Integrations (to wire up)

The prototype shows these as live; they need real connectors:

| Source | What it feeds |
|---|---|
| **Plaid** (or Teller) | Finance Pulse, account list, daily/monthly delta |
| **Coinbase / brokerage APIs** | Crypto + equity values, allocation bars |
| **Oura** | Sleep score, HRV, RHR |
| **Whoop** | Recovery, strain |
| **Apple HealthKit** | Steps, weight, VO2 max |
| **Libre 3 / Dexcom** | Glucose |
| **Google Calendar** | Calendar events, all-day blocks |
| **Google Drive** | Document attachments in journal/agent |
| **Telegram Bot API** | Agent ingress + outbound replies |
| **X / LinkedIn / Substack / GitHub / IG APIs** | Social follower counts and growth |
| **Custom workout app or Strong API** | Training session lifts, PRs |

Agent runtime: webhook receives Telegram messages → dispatch to LLM with the
tool set above → write results to DB → push update to UI via websocket / SSE.

---

## File index (what's in this folder)

```
design_handoff_personal_os/
├── README.md                     ← this file
├── reference.jpeg                ← user's reference image (Miles OS)
│
├── prototype/                    ← the design references
│   ├── Personal OS.html          ← entry: design canvas with all artboards
│   ├── hearth.css                ← Hearth Design System tokens
│   ├── app/
│   │   ├── web.html              ← web prototype shell
│   │   ├── mobile.html           ← mobile prototype shell
│   │   ├── app.css               ← all visual styles (themes, modules, etc)
│   │   ├── data.js               ← demo data
│   │   ├── components-shared.jsx ← Card, TopBar, Sparkline, Modal, helpers
│   │   ├── components-modules.jsx← All 10 dashboard modules
│   │   ├── agent.jsx             ← Agent panel + canned reply heuristics
│   │   ├── pages.jsx             ← Finance/Health/Train/Social/Journal pages
│   │   ├── web-main.jsx          ← Web entry component
│   │   ├── mobile-main.jsx       ← Mobile entry + screens
│   │   ├── design-canvas.jsx     ← Canvas shell (starter component)
│   │   ├── tweaks-panel.jsx      ← Tweaks panel + form controls (starter)
│   │   └── ios-frame.jsx         ← Unused; iPhone bezel is hand-drawn in Personal OS.html
```

**Where to start reading:**

1. `prototype/Personal OS.html` — what the user sees first; design canvas with sections
2. `prototype/app/web.html` + `web-main.jsx` — the web app composition
3. `prototype/app/components-modules.jsx` — every dashboard module
4. `prototype/app/agent.jsx` — agent panel + reply behavior
5. `prototype/app/app.css` — visual system, all themes
6. `prototype/hearth.css` — upstream tokens (cream/cocoa/ember/sage scales,
   type, space, radii, shadow, motion)

---

## Acceptance checklist

A faithful port should:

- [ ] Reproduce the 3-zone web layout at 1440px+ widths with the same proportions
- [ ] Numbered cards (`NN //`), mono labels in ALL CAPS tracked `0.16em`
- [ ] Newsreader serif greeting with italic name token
- [ ] Live clock with blinking colon in mono 44px
- [ ] Capture bar (web Session + mobile Home) pushes to agent
- [ ] Agent panel right-rail with chat thread, typing indicator, sage user
      bubbles, agent action chips (sage / ember / honey)
- [ ] All 6 nav tabs route to their own page layouts
- [ ] Habits & tasks toggle on click with sage-tint done state
- [ ] Three themes (dark / cream / warm) switch via root data attribute
- [ ] Mobile: bottom tab nav with Home/Money/Body/Agent
- [ ] No emoji anywhere in chrome or copy
- [ ] Borders OR shadows, never both
- [ ] All motion 160–220ms ease-standard

---

## Things deliberately not built (next pass)

- Calendar week / month views (today only)
- Account-connection auth flows (Plaid Link, OAuth, etc)
- Real LLM agent — current replies are regex heuristics
- CRM module
- Journal editor (only the read view)
- Search / command palette (the `⌘K` chip is decorative)
- Notifications inbox
- Settings / data sync status
- Light theme tested less than dark (verify input contrast)

Confirm scope with the user before building these.
