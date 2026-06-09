---
title: Personal OS — Native iOS App — Mobile Design System & Screen Specs
date: 2026-06-09
owner: Max Allaire
status: Design direction approved screen-by-screen (2026-06-09) — ready for Figma base-file generation
extends: 2026-06-08-personal-os-native-mobile-app-design.md (this is step (1) of that doc's §5 Figma loop, fleshed out)
relates_to: 2026-05-21-personal-os-design.md (web design system — the DNA this evolves)
---

# Personal OS — Native iOS App — Mobile Design System & Screen Specs

> **What this document is.** The detailed visual design for the **native iOS app** (React Native +
> Swift), produced through the brainstorming visual-companion loop and approved by Max screen by
> screen on 2026-06-09. It is the **token-named, component-level, Figma-ready** reference that the
> native-app direction doc (`2026-06-08`) deferred to "design in Figma." It is the seed for the
> **Figma base file** (next step), which Max refines and we translate to React Native per screen.
>
> **Audience.** This is Claude's + Figma's reference material (per Max's working agreement — Max
> directs and evaluates by outcomes, not by reading code/spec internals). It is deliberately
> exhaustive on tokens and component anatomy so the Figma library and the eventual RN components
> are unambiguous.
>
> **Source of visual truth.** The approved HTML mockups, anchored at the **`Personal OS` repo root**
> — full path `/Users/me/Projects/Personal OS/.superpowers/brainstorm/43623-1780955811/`
> (relative: `.superpowers/brainstorm/43623-1780955811/`) — `home-v3.html`, `body-v2.html`, `money.html`,
> `focus-v2.html`, `detail-pages.html`, `capture-v1.html`, `capture-type.html`,
> `capture-states.html`. These are **direction-only** (HTML/CSS); they become React Native via
> Figma. Where this doc and a mockup disagree, this doc wins (it records the reconciled decisions).

---

## 1. Design identity

**Evolve, don't reinvent.** The native app carries the web product's **editorial / terminal DNA**
— serif headlines, mono data labels, hairline structure — made *sleeker, cleaner, with fewer
colors*. It must never read as generic "AI-slop" (uniform card grids, weak hierarchy, emoji,
heavy shadows).

**The five anti-slop rules (non-negotiable):**
1. **Hairlines, not boxes.** Structure comes from 1px dividers and whitespace, not bordered cards.
   (Exceptions are deliberate: the Capture confirmation card, the AI-recommendations panel, the
   journal field — transient/received surfaces that benefit from light containment.)
2. **Big serif + micro mono.** Strong type-scale contrast: a 29–32px Newsreader headline against
   8–9px wide-tracked mono labels. The mid-range is sparse.
3. **Sparse color.** Color is meaning, never decoration. Most of every screen is neutral; blue /
   green / yellow appear only where they carry semantics.
4. **Crafted SVG line-icons only.** 1.7px stroke, rounded caps/joins. **No emoji, ever.**
5. **Fixed ambient depth.** A single blue radial-gradient layer sits behind every screen and
   persists on scroll — the one consistent atmospheric element.

**No section numbers.** Web used `NN //` module headers (e.g. `02 // TODAY`). The native app drops
them — section headers are **plain words**, mono uppercase, wide-tracked. (This supersedes the
native-app direction doc's open question about carrying `NN //` over: decided **against**.)

---

## 2. Design tokens

### 2.1 Color — palette "Vital" (blue-led)

| Token | Value | Role |
|---|---|---|
| `color.bg` | `#0E1014` | App background (warm-dark base) |
| `color.surface` | `#14171C` | Raised surface (avatars, bars, inset fills) |
| `color.surface.sheet` | `#12151A` | Elevated sheet surface (Capture) |
| `color.fg.1` | `#F2EEE6` | Text primary (warm off-white) |
| `color.fg.2` | `rgba(242,238,230,.72)` | Text secondary |
| `color.fg.3` | `rgba(242,238,230,.52)` | Text tertiary |
| `color.fg.4` | `rgba(242,238,230,.36)` | Text quaternary / micro-labels |
| `color.line.1` | `rgba(242,238,230,.07)` | Hairline, faint (section/list dividers) |
| `color.line.2` | `rgba(242,238,230,.12)` | Hairline, standard (borders, inactive segs) |
| `color.blue` | `#4F9DE0` | **Lead** — nav-active, primary, focus, "now", ambient glow, selected |
| `color.green` | `#5FC982` | Positive / health / "up" / done / on-streak |
| `color.yellow` | `#F1DA85` | Attention / high-intensity / strain / needs-permission |

**Semantic rules:**
- **Intensity ramp:** blue → green → yellow encodes low → good → high (e.g. recovery ring sweeps
  blue→green; strain is yellow; nutrition ring blue→green).
- **Direction:** "up / positive" = green ▲. **"down / negative" = calm muted neutral ▼**
  (`color.fg.3`), **never red.** "flat / held" = `color.fg.4` with an em-dash.
- **Attention ≠ error.** Yellow signals "look here / high / needs action" (e.g. the write-back
  permission gate). There is **no red** in the system.

### 2.2 Ambient gradient (fixed depth layer)

The atmospheric layer behind every screen. Fixed — does **not** scroll with content.

```
background:
  radial-gradient(110% 38% at 50% 0%,  rgba(79,157,224,.13), transparent 62%),
  radial-gradient(130% 46% at 50% 46%, rgba(79,157,224,.085), transparent 68%),
  radial-gradient(130% 42% at 50% 92%, rgba(79,157,224,.06),  transparent 70%),
  #0E1014;
```

Three stacked blue radials (top / middle / bottom), low opacity, over `color.bg`. In RN this is a
fixed background view; content scrolls above it. Sheets add a 4th localized glow at their top edge
(agent identity): `radial-gradient(120% 36% at 50% 0%, rgba(79,157,224,.10), transparent 64%)`.

### 2.3 Type

Three families, already in the codebase. Loaded via Google Fonts in mockups; bundled in RN.

| Family | Token | Role |
|---|---|---|
| **Newsreader** (serif) | `type.serif` | Headlines, greetings, screen titles, journal prompts, agent intro. Often **italic** for emphasis (the *Max.* in "Good afternoon, Max."). Weights 400/500/600 + italic 400/500. Optical sizing on. |
| **JetBrains Mono** | `type.mono` | All labels + data: section headers, micro-labels, metric values, times, nav labels, meta. **`tabular-nums` always** on numbers. Micro-labels are uppercase, wide-tracked (.14–.18em). |
| **Manrope** | `type.sans` | Body & UI: list-row titles (tasks, events, accounts, lifts), agent notes, descriptions, button labels. Weights 400–800. |

**Type scale (key roles):**

| Role | Family / weight / size | Tracking |
|---|---|---|
| Screen title (serif) | Newsreader 500 · 29–32px | -.02em |
| Greeting (Home) | Newsreader 500 · 32px | -.02em |
| Eyebrow / date | Mono 700 · 9px · uppercase | .16em |
| Section header | Mono 700 · 11px · uppercase | .16em |
| Micro-label | Mono 600 · 8px · uppercase | .16em |
| Metric value (hero) | Mono 600 · 21–44px · tabular | -.01em |
| List-row title | Manrope 600 · 14px | -.01em |
| Row sublabel | Mono 600 · 8px · uppercase | .10em |
| Agent note / body | Manrope 500 · 12.5–13.5px · 1.5–1.66 line | — |
| **User utterance (Capture)** | **Manrope 600 · 16.5px · normal** | **-.01em** |
| Nav tab label | Mono 600 · 7.5px · uppercase | .08em |

> **Decision (2026-06-09):** the user-utterance echo in Capture uses **Manrope clean (Option A)** —
> modern, confident, "luxury without formality." Newsreader-serif-italic is retired for that
> element. (Serif italic remains for greetings, titles, journal prompts, and the agent intro line.)

### 2.4 Shape, elevation, motion

| Token | Value |
|---|---|
| `radius.phone` | 42px (device frame, mockup only) |
| `radius.sheet` | 28px (top corners) |
| `radius.card` | 14–15px |
| `radius.field` | 16–18px |
| `radius.pill` | 9–12px |
| `radius.chip` | 8–9px |
| `elevation.fab` | `0 8px 20px rgba(79,157,224,.35)` |
| `elevation.sheet` | `0 -20px 50px rgba(0,0,0,.5)` |
| `blur.nav` | backdrop-blur 16px over `rgba(14,16,20,.82–.9)` |
| Icon stroke | 1.7px, round cap/join (nav/UI); 1.6–2.0 for inline glyphs |

**Motion (light, purposeful):** the "now" node carries a soft blue pulse-ring; the voice state
pulses concentric rings + an animated waveform. Otherwise transitions are quiet (sheet slide-up,
tab cross-fade). No bouncy/elastic motion.

---

## 3. Navigation & information architecture

**Structure A — bottom tab bar with a center capture spine:**

```
   Home  ·  Body  ·  ( ⊕ )  ·  Money  ·  Focus
```

- **Bar:** 70px, hairline top (`line.1`), translucent `rgba(14,16,20,.82–.9)` + 16px backdrop blur.
- **Tabs:** icon (1.7px line) + 7.5px mono label. Inactive `fg.4`; **active = `color.blue`** (icon)
  + `fg.1` (label).
- **Center ⊕ = Capture FAB:** 46px blue circle, raised `-12px`, blue glow. Not a tab — a
  **persistent agent/capture surface** (the spine). Opens the Capture sheet over any screen.
- **Icons:** Home = house · Body = pulse-wave · Capture = plus · Money = **banknote** (rect + center
  circle + side ticks) · Focus = **target-check** (circle + check).

**Module map (mobile re-prioritizes the web module set into 4 destinations + the spine):**

| Tab | Absorbs (web modules) | Primary data sources |
|---|---|---|
| **Home** | Dashboard / agenda glance | All (summary) |
| **Body** | Health + Training + Nutrition | Whoop (live), Apple Health (→ native HealthKit), Strava |
| **Money** | Finance | Plaid (Max-owned) |
| **Focus** | Calendar + Tasks + Habits + Journal | Google Calendar (live) + local task/habit/journal store |
| **⊕ Capture** | (agent spine) | Routes to **all** modules |

Secondary destinations (Social / Inbox / Settings) hang off the Home header/profile, not the tab bar.

---

## 4. Component inventory (for the Figma library)

Each is a reusable component → becomes a Figma component + an RN component. Token-named.

| Component | Anatomy | Notes |
|---|---|---|
| **Status bar** | time (mono 12) · signal/battery (mono 10, `fg.3`) | Mockup chrome; real app uses iOS status bar |
| **App header** | brand dot (colored) + `MAX OS` (mono .14em) · avatar `MA` (30px ring) | Brand dot color cues the screen (blue Home, green Body) |
| **Eyebrow** | mono 9 uppercase `fg.4` (e.g. "Focus · Friday, May 8") | Above every screen title |
| **Screen title** | Newsreader 29–32, italic emphasis span | A *read* of state, not a label (see §5) |
| **Section header** | word (mono 11 uppercase .16em) + meta (mono 9 `fg.4`), hairline-top | Plain words, no numbers |
| **Vitals/stat row** | flex cells split by `line.1` left-borders; label + value (+ seg/sub) | Home vitals strip; reused as inline stat groups |
| **Gradient ring** | conic `blue→green` (or →yellow), inner `bg` hole, centered value | Recovery, Nutrition. Sweep angle = % |
| **Segment dots** | row of 9×4 pills; on = `green` | Home habits mini; distinct from habit week-dots |
| **Sleep-stage bar** | horizontal stacked bar (deep/REM/light/awake) + legend | Body |
| **Sparkbars** | flex bars, last/peak `.hi` = `yellow` | Body strain 7-day |
| **Progress bar** | track `surface`, fill gradient (`green→yellow` or solid `green`) | Strain target, Tasks done |
| **Area trend chart** | SVG: gridlines `.05`, fill = `green` linear-gradient ↓ transparent, 2px `green` stroke, end dot | Money net-worth |
| **Allocation stacked bar** | single rounded bar, segments by class color; legend rows below | Money |
| **Range pills** | equal-width pills (1W/1M/3M/1Y/ALL); active = blue tint + blue border | Money; reusable time-range control |
| **List row — account** | name (Manrope 14) + class label; value (mono) + delta (▲green / ▼muted / —dim) | Money |
| **List row — lift** | name + scheme (3×5); weight (mono) + optional **PR tag** | Body, Capture confirmation |
| **PR tag** | mono 8 `green`, .4-alpha green border, 5px radius | Body, Capture |
| **Week strip** | 7 day-cells (letter + date + density dot); today = blue tint + blue border | Focus calendar |
| **Event row** | time (mono, left) + status dot (done green / now blue-glow / up hollow) + title + sub + chevron | Focus calendar; tappable → detail |
| **Task row** | checkbox (done = green + check) + title (struck when done) + sub (time in blue) + optional yellow flag + chevron | Focus tasks; tappable → detail |
| **Habit row** | name + streak count (`green`, or `fg.4` when reset) + 7 week-dots (on=green, today=blue-ring) | Focus habits |
| **Journal field** | bordered block: Newsreader-italic prompt + hairline + "tap to write" with blue caret | Focus |
| **Timeline row** | time/NOW (left) + node (done green / now blue-pulse / up hollow) + connector line + title + sub | Home TODAY |
| **Detail facts row** | label (mono) ↔ value (Manrope) / attendee stack, hairline-split | Detail pages |
| **AI-recommendations panel** | bleed-to-edge block, faint blue top-glow, hairline top/bottom; header "Recommended" + blue agent dot + "AI · N"; rows = spark glyph + text + action chip | Detail pages; the agent reaching in |
| **Action chip (accent)** | mono 9 uppercase, blue .4 border, blue text, optional leading icon | Detail recs, Capture |
| **Action bar** | row of equal pills; primary = blue fill (`bg` text); others = `line.2` border | Detail pages |
| **Capture sheet** | bottom sheet (`radius.sheet`, top glow), grabber + header + conversation + input dock | The ⊕ surface |
| **Confirmation card** | hairline card; module tag (colored by module) + ✓; **entry rendered in destination module's row grammar**; agent note; Undo + Edit/View chips | Capture — most reusable cross-module piece |
| **Permission card** | yellow-tinted variant of confirmation card: lock glyph + "needs access"; pending change dimmed; note; **Grant** (blue) + Not-now; scope line | Capture write-back gate |
| **Voice/dictation state** | pulsing mic orb (concentric blue rings) + animated waveform + "Listening…" + live transcript (committed `fg.2` / pending `fg.4` + blue caret); dock = Cancel · Stop · Keyboard | Capture |
| **Bottom nav + center FAB** | see §3 | Every primary screen |
| **Ambient gradient bg** | see §2.2 | Fixed, every screen |

---

## 5. Screen specs

Every primary screen shares the spine: **ambient bg → status → header → eyebrow → serif title →
hairline-separated sections → bottom nav.** The serif **title is a *read*** — a one-line synthesis
of the screen's state, with an italic emphasis word — not a static label.

### 5.1 Home (`home-v3.html`)
Agenda-led glance. **"Good afternoon, *Max.*"** (greeting + date eyebrow) → **vitals strip**
(Recovery · Sleep · Net worth · Habits, hairline-bounded) → **`TODAY` timeline** (done → now → next;
green done-nodes, blue-glow NOW, hollow upcoming). Capture is the ⊕ only (no inline capture line).

> **Reconciliation note:** `home-v3.html` is slightly stale vs. the locked language — it still shows
> a `02 //` section number and only a single top glow. **Home must be updated** to (a) drop the
> number (plain `TODAY`) and (b) use the full 3-layer ambient gradient like Body/Money. Build to
> this spec, not to the stale mockup.

**Home vs. Focus boundary (important):** Home's timeline is a **curated blend glance** — a few
events + the now-block + a task or two, woven together ("what's my day look like"). **Focus** is the
**complete, typed working surface** (all events, all tasks, etc.). Same data, two altitudes — no
redundancy.

### 5.2 Body (`body-v2.html`)
Canonical visual reference (most current). Eyebrow "Body · …" → title **"Well recovered."** Sections:
- **Recovery** — gradient **ring** (blue→green, sweep = %) + HRV / RHR / SpO₂ stat-lines + a serif
  italic read-out ("Green to push…"). Source meta `WHOOP · 6:42 AM`.
- **Sleep** — duration + quality% + **sleep-stage bar** + 4-up legend (deep/REM/light/awake).
- **Strain** — yellow value + target + `BUILDING` + progress bar + 7-day **sparkbars** (peak yellow).
  > **Label confirmed: "Strain"** (the Whoop metric). Not "Strength." (Open item resolved 2026-06-09.)
- **Training** — PR count + session tag + **lift rows** with green **PR tags**.
- **Nutrition** — kcal **ring** + protein/carbs/fat **macro bars**.

### 5.3 Money (`money.html`)
Eyebrow "Money · …" → title **"Up 8.9% this month."** → **Net Worth** value + green ▲ delta →
**area trend chart** (green) → **range pills** → **Allocation** (stacked bar + legend) → **Accounts**
list (▲ green / ▼ **muted** / — dim). Source `… LINKED · PLAID`. The Coinbase row demonstrates the
down-is-muted-not-red rule.

### 5.4 Focus (`focus-v2.html`)
The **working surface**. Eyebrow "Focus · …" → title **"Two deep blocks *left.*"** Sections:
- **Calendar** — `GOOGLE CAL · N TODAY`. Compact **week strip** (today blue; density dots) + today's
  **events as timed rows** (meetings, lunch, calls, dinners — mixed types). Deliberately *not* a
  re-listed full timeline (Home owns that). **Reads live from the existing Google Calendar sync.**
- **Tasks** — `N / M DONE` + progress bar, grouped **Today / This week**. **Task rows** with
  checkboxes; time-blocked tasks show a blue time range; high-priority = yellow flag.
- **Habits** — **habit rows**: name + streak count + 7 week-dots (green done, blue-ring today). A
  reset streak shows **"Streak reset · 0"** in muted `fg.4` — never red.
- **Journal** — **journal field**: Newsreader-italic prompt + "tap to write" + blue caret; meta
  shows last-entry + streak.

**Every event and task row is tappable → its detail page** (chevron affordance).

### 5.5 Detail page (`detail-pages.html`) — event & task
One **shared template**, content flexes by type. Pushed screen (back chevron → Focus; tab bar stays,
Focus active).
- **Header** — back ("‹ FOCUS") + overflow (•••).
- **Eyebrow** — type + source (`● Event · Google Calendar` / `▢ Task · Build · High priority`).
- **Title** — Newsreader, the item name with italic emphasis.
- **Facts** — hairline rows: When / Where / With (attendee stack) for events; When / Estimate /
  Project for tasks.
- **About** — plain-language description (Manrope, `fg.2`). From the calendar invite (event) or the
  user's note (task).
- **Recommended (AI)** — the **AI-recommendations panel**: context-aware suggestions from the ⊕
  agent, each with a one-tap **action chip** (e.g. event → "you owe Sequoia the pricing deck" ·
  *Open draft*; task → "2 sync errors logged 03:14 overnight" · *View errors*). See §6.3 for the
  agent dependency + degraded state.
- **Action bar** — Join / Reschedule / Notes (event) · Start / Complete / Snooze (task); primary blue.

### 5.6 Capture sheet (`capture-v1.html` + `capture-states.html`)
The ⊕ spine. A bottom sheet over a dimmed/blurred current screen.
- **Header** — blue agent dot + `CAPTURE · AGENT` (or `· LISTENING`) + close.
- **Conversation** — agent intro (Newsreader italic, "Tell me what happened — I'll file it where it
  belongs."), then exchanges: **user utterance** (Manrope clean, right-aligned, with a `YOU · time`
  eyebrow) → **confirmation card**.
- **Confirmation card** — module tag (colored: Body green, Calendar blue, …) + ✓; the parsed entry
  **rendered in the destination module's own row grammar** (a lift row for Body, an event-change for
  Calendar); a one-line agent note; **Undo + Edit/View** chips. *This card is the most reusable piece
  in the app — Capture has almost no bespoke UI; it composes other modules' rows.*
- **Input dock** — quick-intent chips (Workout · Expense · Task · Note) + field ("Log anything…") +
  **mic** + blue **send**.

**Voice / dictation state** — explicit feature (added 2026-06-09). Tap mic → sheet enters
**Listening**: pulsing blue mic orb + animated waveform + "Listening…" + **live transcript**
(committed text `fg.2`, in-progress `fg.4`, blue caret). Dock = Cancel · **Stop** · Keyboard.

**Permission (write-back) state** — when an action needs a scope not yet granted, the agent does
**not** fail: it shows the **permission card** — the pending change dimmed, a yellow lock + "needs
access", a plain note ("I can only read your Google Calendar right now"), **Grant calendar edit**
(blue) + "Not now", and the exact scope named (`Google · calendar.events`). Attention-yellow, never
red. See §6.1.

---

## 6. Cross-cutting systems

### 6.1 Write-back capability matrix & permission model

The app moves from **read-only reader** (Phase-1 sync pulls data in) to **writer** (Capture + detail
actions edit data). This splits integrations into two classes:

| Integration | Class | "Edit" means | Scope needed |
|---|---|---|---|
| **Google Calendar** | **System-of-record** | Push change **upstream** (real invite update) | Google **write** (`calendar.events`) — broader than today's read scope |
| **Tasks / Habits / Journal** | **Native-owned** | Edit local store (Supabase) | None (first-party) |
| **Whoop** | **Read-only source** | Edit **local copy** only; never pushed upstream | Read only |
| **Apple Health** | **Read-only source** (→ native HealthKit) | Local copy only | HealthKit read |
| **Strava** | **Read-only source** | Local copy only (Strava activity-edit not needed/​supported) | Read only |
| **Plaid** | **Read-only source** | View only (no transaction write-back) | Read only |
| **X (Twitter)** | TBD | Likely post/compose later | Write later, if any |

**Permission model (two layers):**
1. **At connect time** the user **chooses read vs. read+write** per integration, and the app
   **recommends read+write as the default** (so the agent can act, not just observe). Default-write
   keeps the agent useful out of the box.
2. **In-Capture fallback gate** — if a user took the narrower read-only path and later asks for an
   edit, the **permission card** (§5.6) requests the specific scope just-in-time, then proceeds.

> This is the meatiest *build-time* implication: write scopes, write endpoints, and per-integration
> "upstream vs. local" routing are new backend work layered on the existing read-sync. The **design**
> is settled; the API wiring is an implementation concern flagged for the build phase.

### 6.2 Voice / dictation
A first-class capture input (not just a key on the keyboard). Drives the §5.6 Listening state with
live partial transcript. Implementation: on-device speech-to-text feeding the same agent pipeline as
typed input (transport differs, routing identical).

### 6.3 AI recommendations — agent dependency & graceful degradation
The **Recommended** panels (detail pages) and the agent **routing/confirmations** (Capture) depend on
the **Phase-2 agent** (the ⊕ spine). Until that agent is live:
- Detail pages ship with **About + facts + actions**; the **Recommended** panel shows an
  empty/"agent off" state (design the empty state).
- Capture can still do **deterministic** parses (log a workout, add a task) without rich
  recommendations; the conversational prep/insight lights up when the agent lands.

### 6.4 Color semantics recap
Up = green ▲ · Down = muted neutral ▼ (`fg.3`) · Flat/held = dim — (`fg.4`). Intensity ramp
blue→green→yellow. Attention = yellow (incl. permission gate). **No red anywhere.**

---

## 7. Data bindings (which screen reads what)

| Screen | Reads from | Status |
|---|---|---|
| Home vitals | Whoop (recovery/sleep), Plaid (net worth), habits store | Whoop live; Plaid Max-owned |
| Body | Whoop (live), HealthKit (native, pending), Strava (dormant) | Whoop live |
| Money | Plaid | Max-owned, pending |
| Focus · Calendar | **Google Calendar (live)** | Live in prod |
| Focus · Tasks/Habits/Journal | Native Supabase store | New (native-owned) |
| Capture / Detail recs | Phase-2 agent over all of the above | Future |

The native app is a **new client** of the existing client-agnostic backend (Supabase + provider-aware
OAuth token store + sync engines). Cloud-API integrations need **mobile OAuth flows** (in-app browser
+ deep-link) but no new sync machinery.

---

## 8. Open / deferred (for later Figma iterations)

- **Onboarding / connect flow** (first launch: sign in → connect integrations w/ read-vs-write choice
  → grant HealthKit). Surfaces the §6.1 default-write recommendation. **Not yet designed.**
- **Settings / Social / Inbox** secondary screens (off Home header). Not yet designed.
- **"Agent off" empty states** for Recommended panels (§6.3).
- **Per-day Calendar navigation** (tapping a week-strip day) — interaction detail.
- **Android** — out of scope (iOS-first; RN keeps the door open).
- Mobile auth (token session), HealthKit module build-vs-library — **build-time**, per the native-app
  direction doc §7.

---

## 9. Figma handoff (next step)

1. **Tokens → Figma variables.** §2 maps 1:1 to variable collections: `color/*`, `type/*`,
   `radius/*`, `elevation/*`. The ambient gradient + sheet glow are named effect/fill styles.
2. **Components → Figma library.** §4 inventory becomes the component set; the **confirmation card**
   is built to *embed* module row-components (so Body/Money/Focus rows are shared, not duplicated).
3. **Screens → frames.** §5 specs become frames at 344-wide artboards, composed from the library.
4. Then the §5-loop of the native-app doc runs: **generate base Figma file → Max refines → read back
   → translate to React Native, per screen.** Use the Figma MCP skills (`figma-use`,
   `figma-generate-design`, `figma-generate-library`, `figma-code-connect`) — do not free-hand.

**Build remains Max-directed / prompt-driven.** No React Native screen is built until its Figma
design is approved.
