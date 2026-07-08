# Personal OS Mobile — "Ivy/Porcelain" Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the locked Claude Design handoff (spec-sheet aesthetic, light "Porcelain" + dark "Ivy" modes) across the Expo RN app — Home, Body, Money, Focus, new Assistant sheet — preserving all live Supabase data wiring.

**Architecture:** A themed foundation layer (palette + type + motion + band/ledger/stat primitives) lands first; five screen rebuilds then consume it in parallel; periphery screens (Login/Detail/Capture) are rethemed; old three-voice tokens are retired. State-based nav (NavContext) is extended with an `assistant` overlay.

**Tech Stack:** Expo SDK 56 / RN, TypeScript strict, StyleSheet, react-native-reanimated 4.3.1, react-native-svg 15.15.4, @expo-google-fonts/manrope + geist-mono, Supabase (existing hooks).

## Global Constraints

- Worktree: `/Users/me/Projects/Personal OS/.claude/worktrees/mobile-app`, branch `feat/native-mobile-app-screens`, app dir `mobile/`.
- Spec of record: `design_handoff_personal_os/README.md`, `system-tokens.md`, canvas sections #t6 (Home 6b/6c), #t7 (7a Body / 7b Money / 7c Focus), #t8 (8a Assistant). Reference screenshots: `spec-t6-home.png`, `spec-t7-siblings.png`, `spec-t8-assistant.png` (repo root of main tree). Everything else in the canvas is exploration — ignore.
- **NO new dependencies.** No gesture-handler (use `PanResponder`), no expo-linear-gradient (use `react-native-svg` `<LinearGradient>` or low-alpha solid fills).
- Fonts: Manrope_400Regular/500Medium/600SemiBold/700Bold + GeistMono_400Regular/500Medium/600SemiBold. Instrument Serif and Hanken Grotesk are **removed**.
- Both modes from day one via `useColorScheme()`; every color comes from `useTheme()` — **zero hardcoded colors in screens**.
- All times 12-hour ("9:30 AM", "1:16 PM"). Times/dates are always ink-at-opacity, never accent-colored (except where spec says accent, e.g. dark-mode focus band time).
- State color rules: sleep >7h green / 6–7h amber / <6h red; habits >3/6 green else amber; money positive green / negative red.
- Live hooks preserved exactly: `useHealthToday`, `useHomeHabits`, `useHabits`, `useTasks`, `useCalendarToday`, `useJournal`, `useSession`, `useNav`. Task/habit toggle + journal write behavior on Focus must keep working (mapped onto the new queue rows).
- Money stays mock (Plaid is Max-owned). New-to-design data points (sleep stages, rest HR, weight, tonnage, net-worth sparkline, runway, assistant recs) are mock constants in `src/data/*.ts`, clearly commented `// mock — no provider yet`.
- Components ≤150 lines, functional, named exports. Conventional commits authored as ClawdGItMan.
- Gate per wave: `npx tsc --noEmit` clean + `npx expo export --platform web` succeeds.

---

### Task A — Foundation: theme, motion, primitives, tab bar, shell

**Files:**
- Create: `mobile/src/theme/palette.ts`, `mobile/src/theme/ThemeContext.tsx`, `mobile/src/theme/typeRoles.ts`, `mobile/src/theme/layout.ts`
- Create: `mobile/src/motion/FadeUp.tsx`, `mobile/src/motion/useFillAnim.ts`, `mobile/src/motion/Shimmer.tsx`
- Create: `mobile/src/components/spec/Band.tsx`, `StatGrid.tsx`, `LedgerRow.tsx`, `Eyebrow.tsx`, `ScreenHeader.tsx`, `TitleBlock.tsx`, `DayBar.tsx`, `RecoveryDial.tsx`, `HrvBars.tsx`, `Sparkline.tsx`, `SparkButton.tsx`, `TabBar.tsx`, `iconsSpec.tsx`
- Create: `mobile/src/lib/format.ts`
- Modify: `mobile/App.tsx` (fonts → Manrope+GeistMono; wrap in ThemeProvider; themed StatusBar `style={mode==="dark"?"light":"dark"}`; replace AmbientBackground with themed solid bg; swap BottomNav→TabBar)
- Modify: `mobile/src/navigation/NavContext.tsx` (add overlay kind `"assistant"`, `openAssistant()`)

**Interfaces (all later tasks consume these — exact):**
```ts
// theme/palette.ts
export type Mode = "light" | "dark";
export type Palette = {
  bg: string; surface: string; sheet: string; ink: string;
  ink72: string; ink64: string; ink50: string; ink38: string; ink34: string; ink28: string;
  hairSection: string; hairCol: string; hairRow: string;
  accent: string; accentDeep: string; amber: string; amberPip: string; red: string;
  bandBorder: string; bandBorderRecovery: string; bandGrad0: string; bandGrad1: string;
  dialTrack: string; hrvBar: string; pipTrack: string; dayFill: string; dayTrack: string;
  tabInactive: string; captureBg: string; captureRing: string; indicator: string;
  scrim: string; shimmer: string; onAccent: string;
};
export const light: Palette; export const dark: Palette;
// LIGHT: bg #F5F3ED surface #FFFFFF sheet #F5F3ED ink #0F1115; dims rgba(15,17,21,.72/.64/.5/.38/.34/.28);
// hairlines .1/.07/.06; accent #1E7A52 deep #175E40 amber #A8842B amberPip #B9973E red #B0472F;
// bandBorder rgba(30,122,82,.28) recovery .24; grad rgba(30,122,82,.055)→.02; dialTrack rgba(15,17,21,.08);
// hrvBar rgba(30,122,82,.35); dayFill rgba(15,17,21,.38) dayTrack rgba(15,17,21,.08);
// scrim rgba(15,17,21,.38); shimmer rgba(255,255,255,.65); onAccent #F5F3ED.
// DARK: bg #0C0F0C surface #141813 sheet #0F120F ink #EFEDE2; dims .72/.66/.5/.4/.34/.28 of 239,237,226;
// hairlines .12/.08/.07; accent #6CAB86 deep #3A6B51 amber #C9A45C red #C86A5A;
// bandBorder rgba(108,171,134,.28); grad rgba(108,171,134,.06)→.025; dialTrack rgba(239,237,226,.09);
// hrvBar rgba(108,171,134,.36); dayFill rgba(239,237,226,.45); scrim rgba(0,0,0,.55);
// shimmer rgba(239,237,226,.5); onAccent #0C0F0C.

// theme/ThemeContext.tsx
export function ThemeProvider({children}): JSX.Element;         // reads useColorScheme()
export function useTheme(): { mode: Mode; c: Palette; t: TypeRoles };

// theme/typeRoles.ts — TypeRoles: TextStyle per role, built from a Palette:
// wordmark(10, GM500, ls .34em→3.4, c.ink50) · eyebrow(9.5, GM500, ls 2.28, ink50, uppercase)
// screenTitle(16, M600, ls -0.32) · statusLine(13, M400, lh 19.5, ink64) · bandTitle(21, M700, ls -0.52)
// bandLabel(8.5, GM500, ls 1.7, accent, uppercase) · bandSub(9.5, GM500, ls 0.95, ink50, uppercase)
// heroValue(30, GM600, ls -0.9) · timerValue(34, GM600, ls -1.02) · statValue(20, GM600, ls -0.2)
// statLabel(9, GM500, ls 1.62, ink50) · statSub(8.5, GM500, ink50) · sectionHeader(10.5, GM600, ls 2.73, ink72)
// ledgerTime(11, GM400) · ledgerTitle(14, M500) · tag(8.5, GM500, ls 1.02, ink34)
// tabLabel(7.5, GM500, ls 1.2) · chip(11.5, M500) — "GM"=GeistMono, "M"=Manrope; ls in px (em×size).

// motion
export function FadeUp({index, children, style?}): JSX.Element;  // 14pt rise+fade 600ms cubic-bezier(.22,.7,.25,1), delay [.02,.07,.12,.19,.25,.31,.37,.43][index]s
export function useFillAnim(pct: number, opts?: {delay?: number; duration?: number}): AnimatedStyle; // width `${0→pct}%`, 1.2s default, .45s delay
export function Shimmer({width}): JSX.Element;                   // 56pt streak sweep, 3s loop, 2s initial delay

// components/spec
export function Band({variant, children, index}): // "plain"|"accent"|"recovery" — full-bleed borders top+bottom, pad 17/24; accent adds gradient bg (SVG rect) + accent borders; wraps in FadeUp(index)
export function StatGrid({items, index}): // items: {label, value, sub, valueColor?, subColor?, pips?: {n,of}}[]; 3 cols, column hairlines, values 20/GM600
export function LedgerRow({time, title, tag, state, onPress?}): // grid 58|1fr|auto gap12 pad12/0; state "done" (accentDeep square, struck ink50 title, time ink34) | "up" (outlined square, ink72 title, time ink50)
export function Eyebrow({left, right}): // mono row, both ink50
export function ScreenHeader(): // MAX OS wordmark + SparkButton 34×34 (opens assistant via useNav().openAssistant())
export function TitleBlock({title, status}): // status: (string | {b: string})[] — bold segments Manrope 600 ink
export function DayBar({pct}): // 2pt bar, dayTrack/dayFill + endpoint dot, animated fill (home only)
export function RecoveryDial({score}): // SVG semicircle r58 stroke5 round caps, dasharray 182.2, animate dashoffset 182.2→182.2*(1-score/100) 1.6s cubic-bezier(.16,1,.3,1); big value centered under arc
export function HrvBars({heights?, label, sub}): // 7 bars w6 r2 gap3, heights [14,17,12,19,16,21,26], first 6 c.hrvBar last c.accent, scaleY-in .6s stagger .06
export function Sparkline({points?, width, height}): // SVG polyline draw-in via dashoffset 1.5s + endpoint dot, accent
export function TabBar(): // 5 slots Home/Body/[capture 50×50 r14 surface+ring, "+"]/Money/Focus; active: 16×2 accent tick above icon, icon ink, label ink72; inactive tabInactive; top hairline; icons from iconsSpec (home, body silhouette, dollar, lamp, plus) 20pt stroke 1.5
export function SparkButton(): // 34×34 circle surface, ring accent-tint (.35 light/.4 dark), spark SVG path M12 3.5c.7 4.2 2.8 6.3 7 7-4.2.7-6.3 2.8-7 7-.7-4.2-2.8-6.3-7-7 4.2-.7 6.3-2.8 7-7Z + dot (19.4,4.6) 50%

// lib/format.ts
export function time12(d: Date | string): string;  // "1:16 PM"
export function pct(n: number): string;
```

- [ ] A1. Write `palette.ts` with both palettes (values above, verbatim from system-tokens.md).
- [ ] A2. Write `typeRoles.ts` + `layout.ts` (gutter 24, band pad 17, radii: capture 14, week cell 8, pill 999).
- [ ] A3. Write `ThemeContext.tsx`; wire into `App.tsx` with Manrope/GeistMono via useFonts; remove Instrument Serif + Hanken imports; StatusBar themed.
- [ ] A4. Write motion kit (Reanimated 4: `useSharedValue`+`withDelay`+`withTiming`; bezier via `Easing.bezier`).
- [ ] A5. Write spec primitives + `iconsSpec.tsx` + `TabBar.tsx` + `SparkButton.tsx`.
- [ ] A6. Extend NavContext with `assistant` overlay + `openAssistant()`.
- [ ] A7. `format.ts`; gate: `npx tsc --noEmit` clean; export web OK (screens still old-styled — expected mixed look until Wave B).
- [ ] A8. Commit `feat(mobile): ivy/porcelain theme foundation — palettes, type roles, motion kit, spec primitives, themed shell`.

### Task B1 — Home rebuild (spec 6b/6c)

**Files:** Rewrite `mobile/src/screens/HomeScreen.tsx`; modify `mobile/src/data/home.ts` (12h times, focus-session mock, keep `applyLiveHome`); delete usages of GreetingBlock/VitalsStrip/TimelineRow/SectionEnter/AppHeader in Home.
**Consumes:** everything from Task A. **Produces:** nothing downstream.
- [ ] Layout top→bottom: ScreenHeader · Eyebrow("FRIDAY · MAY 8" → live date, right `DAY ${n}%`) · DayBar(55→live day progress from wake window 6:00–23:00) · TitleBlock("Good afternoon, Max." greeting by time-of-day + status line with bold **green** / **Sequoia call**) · FOCUS live Band(accent: label FOCUS + right time; title "Deep work — pricing model" bandTitle; sub "44 MIN IN · ENDS 3:00 PM"; 3pt fill 42% + Shimmer) · RECOVERY Band(recovery: RecoveryDial(72→live) left, right column "HRV · 7D" + HrvBars + "64 MS · REST 48") · StatGrid(SLEEP 7:12 sub "87% QUAL" — value ink, state-colored ONLY per sleep rule on the label pips? No: sleep value stays ink on Home per README; NET WORTH $2.83M sub accent "+0.03% · 30D"; HABITS 4/6 + 6 pips 4 accent) · TODAY section header + ledger (times 12h; done/up states; tags OPS/CAL/BODY/FOCUS/HABIT) · (TabBar comes from shell).
- [ ] Live: keep `useHealthToday` → dial score, HRV sub, sleep value; `useHomeHabits` → habits stat + pips. Sleep value color: apply state rule (7:12 → stays ink on Home vitals per canvas; the green sleep treatment is Body's).
- [ ] Gate: tsc clean. No commit (B tasks commit together after B5).

### Task B2 — Body rebuild (spec 7a)

**Files:** Rewrite `mobile/src/screens/BodyScreen.tsx`; rewrite `mobile/src/data/body.ts` (stages, rest HR, weight, training, week — mock constants matching spec; 12h); remove body/* subcomponents that no longer apply (keep any still used by Detail).
- [ ] Eyebrow right "WEEK 19" (live ISO week). Title "Body" + status. RECOVERY band (same dial/HRV comps, live via `useHealthToday`). TRAINING · DONE accent band (time 11:00 AM — accent in dark / ink in light; "Push day — 4 PRs"; "52 MIN · TONNAGE 12,480 LB"). SLEEP band: right "10:58 PM → 6:10 AM"; 7:12 heroValue **accent green** (state rule; amber 6–7, red <6 — live sleepHours) + "87% QUALITY"; 6pt stage bar (deep 16.7% accentDeep / REM 25% accent / core flex accent-tint .28 light /.32 dark) + legend "DEEP 1:12 REM 1:48 CORE 4:12". StatGrid REST HR 48 (−2 · 7D) / HRV 64 (↑ +6 VS AVG in accent) / WEIGHT 182.4 (−0.6 · 30D). THIS WEEK · 4 SESSIONS: 7 blocks 22pt r4 — M,T,T,F filled accent (F ringed + weekday label ink72), W,S,S track.
- [ ] Gate: tsc clean.

### Task B3 — Money rebuild (spec 7b)

**Files:** Rewrite `mobile/src/screens/MoneyScreen.tsx`; rewrite `mobile/src/data/money.ts` (all mock; 12h).
- [ ] Eyebrow right "RUNWAY 34 MO". Title "Money" + "Net worth's **steady** and May spend is on pace." NET WORTH band (**ink hairlines, not accent**): $2.83M heroValue accent + sub "+$847 TODAY · +0.03% 30D" accent; right Sparkline 118×34. Accounts StatGrid: CASH $412K (LIQUID) / INVESTED $2.31M (+1.2% · 30D accent sub) / DEBT −$104K **value red** (MORTGAGE). MAY BURN band: right "ON PACE" accent; "$8.4K OF $12K" + right "$3.6K LEFT"; 3pt bar 70% accent fill. RECENT ledger ("TODAY · YDA"): amounts right-aligned GM 12/600 — +$12,500 accent / −$7.40, −$210, −$1,842 red; YDA times ink34.
- [ ] Gate: tsc clean.

### Task B4 — Focus rebuild (spec 7c)

**Files:** Rewrite `mobile/src/screens/FocusScreen.tsx`; modify `mobile/src/data/focus.ts` (12h, week cells, live-session mock); keep task/habit/journal mutations working.
- [ ] Eyebrow right "3:12 DEEP TODAY". Title "Focus" + "Two blocks left — **protect the afternoon**." LIVE · DEEP WORK accent band: timer 44:12 timerValue ink (ticks live from mock session start) + right "ENDS 3:00 PM"; sub "Deep work — pricing model"; 3pt fill 42% + Shimmer. StatGrid SESSIONS 3/4 (1 LEFT) / DEEP HRS 3:12 (GOAL 4:00) / STREAK 12 value accent (DAYS). THIS WEEK cells ("MAY 4–10 · AVG 2:54"): 7 cells r8 ringed; weekday letter 8pt + date 13/GM600 + deep-hours 8pt accent; today fully accent-ringed + tinted bg; weekend upcoming dimmed (date ink34, "—"). QUEUE ledger (right "3 LEFT"): live rows from `useCalendarToday` + `useTasks` (as currently wired) restyled as LedgerRows; tapping a task row toggles done (existing mutation); habit rows keep existing toggle; journal entry remains reachable via existing behavior mapped on its row.
- [ ] Gate: tsc clean.

### Task B5 — Assistant sheet (spec 8a, NEW)

**Files:** Create `mobile/src/screens/AssistantSheet.tsx` (+ `mobile/src/components/assistant/` if >150 lines: `TopMove.tsx`, `SeeingRow.tsx`, `AskBar.tsx`); create `mobile/src/data/assistant.ts`; modify `mobile/App.tsx` overlay host (render when `overlay.kind==="assistant"`, ABOVE TabBar like capture).
- [ ] Slide-up sheet over scrim (translateY spring ~550ms, scrim fade), surface `c.sheet`, top radius 22, grabber 36×4. Sections stagger .05/.12/.19/.26/.33/.4s: header (spark 19pt + "ASSISTANT" + close 30pt) · briefing ("You're on pace, Max." 16/600 + line) · TOP MOVE accent band ("Shift tomorrow's training to 4 PM", evidence line, APPLY filled accent pill (text c.onAccent) + LATER outlined) · ALSO SEEING (3) ledger rows 52|1fr|auto (FOCUS/MONEY/HABIT rows with action pills BLOCK/VIEW/7:00 PM) · suggestion chips ×3 outlined · ask bar (pill input surface + inset ring, placeholder ink38, 34pt accent send circle). Dismiss: grabber drag (PanResponder), close button, scrim tap. Actions: APPLY/LATER/pills log + dismiss (stub — no backend yet).
- [ ] Gate: tsc clean. Then single commit for B1–B5: `feat(mobile): rebuild Home/Body/Money/Focus + new Assistant sheet to ivy/porcelain spec`.

### Task C1 — Periphery retheme (Login, Detail, Capture)

**Files:** Modify `mobile/src/screens/LoginScreen.tsx`, `DetailScreen.tsx`, `CaptureSheet.tsx` + their subcomponents under `components/detail/`, `components/capture/` — colors/fonts only via `useTheme()`; keep flows (magic link, detail facts, capture conversation) untouched.
- [ ] Replace old token imports (`color`, `font`, `type` from `theme/tokens`) with `useTheme()`; serif → Manrope 600; blues → accent; ensure both modes read correctly.
- [ ] Gate: tsc clean.

### Task C2 — Retire old system + sweep

**Files:** Delete `mobile/src/theme/tokens.ts`, `mobile/src/components/AmbientBackground.tsx`, `GreetingBlock.tsx`, `VitalsStrip.tsx`, `TimelineRow.tsx`, `SectionEnter.tsx`, `AppHeader.tsx`, `BottomNav.tsx`, `ProgressBar.tsx` + any now-orphaned components (verify with grep before each delete); remove unused font packages from `package.json` (`instrument-serif`, `hanken-grotesk`, `fraunces`, `newsreader`, `space-grotesk`, `space-mono`, `jetbrains-mono` — grep first).
- [ ] `grep -rn "theme/tokens\|InstrumentSerif\|HankenGrotesk" mobile/src mobile/App.tsx` → must be zero before deleting.
- [ ] Gate: tsc clean + `npx expo export --platform web` succeeds. Commit `refactor(mobile): retire three-voice tokens + orphaned components; retheme Login/Detail/Capture`.

### Task D — Full verification

- [ ] `npx tsc --noEmit` + `npx expo export --platform web` green.
- [ ] Serve export; Playwright screenshots: Home/Body/Money/Focus/Assistant × light + dark (emulate `prefers-color-scheme`); visual compare vs `spec-t6/t7/t8` refs; fix deltas (dispatch fix agents if needed); re-shoot.
- [ ] Update `mobile/AGENTS.md` note: theme system + spec pointer. Commit `docs+fix(mobile): verification pass vs locked spec`.
- [ ] Push branch.

### Task E — Project cleanup (after code lands)

- [ ] Update `design_handoff_personal_os/` **in this branch** to the new bundle (delete old prototype files, add new 6 files) + commit `docs(design): 2026-07-08 Claude Design handoff — ivy/porcelain locked spec`.
- [ ] Delete superseded exploration artifacts in worktree root: `home-v1..v9*.png`, `design-directions-review/`.
- [ ] Repo main tree: delete stale screenshots `focus-screen.png`, `phase2-login.png`, `personal-os-login.png`, `.playwright-mcp/*.png`, `spec-t*.png` (after verification done).
- [ ] Remove duplicate `~/Projects/design_handoff_personal_os/` + `~/Projects/Personal OS new design.zip` (only after the bundle is committed & pushed).
- [ ] Stale worktrees: for each of `personal-os-{apple-health,integration-docs,mobile-design,strava,whoop-impl,x-build,x-design}` — check `git -C <dir> status --porcelain` for unique work; if clean and branch pushed/merged, `git worktree remove` (or prune records where dir already moved); report each.
- [ ] Untracked `personal-os-*/` dirs sitting INSIDE the repo root: same check, then remove.
- [ ] Main-tree uncommitted brand/icons work (`public/brand/`, `src/components/brand/`, TopBar edits, deleted `src/app/icons/[icon]/route.tsx`, `docs/security/`, `skills-lock.json`): **do not delete — not ours.** Inspect and report to Max in summary.

## Self-Review

- Spec coverage: 6b/6c→B1, 7a→B2, 7b→B3, 7c→B4, 8a→B5, tokens/motion→A, periphery+system-retire→C, hygiene→E. Assistant trigger (spark on every screen) → ScreenHeader in A, consumed by all B tasks. ✓
- Type consistency: all shared surface defined once in Task A interfaces; B tasks consume only those names. ✓
- No placeholders: token values verbatim; component contracts exact; mock data values enumerated in spec sections referenced per screen. ✓
