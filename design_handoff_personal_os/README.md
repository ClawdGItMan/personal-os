# Handoff: Personal OS — iOS Dashboard (React Native / Expo)

## Overview
Personal OS is a personal dashboard app for iOS with five surfaces — **Home, Body, Money, Focus**, and a context-aware **AI Assistant sheet** — in **light and dark modes**. The design language is a premium "spec-sheet" aesthetic: full-bleed hairline-ruled bands (no cards), Manrope for UI text, Geist Mono for all data/labels/times, a single green accent per mode, and quiet load choreography.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in React Native / Expo** using its established patterns (e.g. `StyleSheet`, Reanimated for the load animations, `react-native-svg` for the dial/sparkline/spark icon, expo-google-fonts for Manrope + a Geist Mono equivalent). The canvas file shows the full exploration history; **only the screens listed under "Locked screens" below are the spec.**

## Fidelity
**High-fidelity.** Colors, type sizes, letter-spacing, spacing, hairline opacities, and animation timings are final. Recreate pixel-perfectly at 390pt width, scaling type/spacing with the platform's conventions.

## Locked screens (the spec)
In `Personal OS - Home.dc.html`, use these canvas sections:
- **Home** — section `#t6`, option `6b` (light) and `6c` (dark)
- **Body / Money / Focus** — section `#t7`, options `7a` / `7b` / `7c` (each shown light + dark, side by side)
- **Assistant sheet** — section `#t8`, option `8a` (light + dark)
Everything in sections `#t1–#t5` and options `6a`/`6d` is exploration history — ignore.

## Design Tokens

### Light mode ("Gallery/Porcelain", from 6b)
- Background `#F5F3ED` · elevated surface `#FFFFFF` · ink `#0F1115`
- Ink opacities: primary `.72`, body `.64`, label `.5`, disabled/inactive `.38`, faint `.34`, hairline-dot `.28`
- Hairlines: section `rgba(15,17,21,.1)`, column `.07`, row `.06`
- Accent green `#1E7A52` · deep green `#175E40` · negative red `#B0472F`
- Accent band: top+bottom border `rgba(30,122,82,.28)` (recovery band `.24`), background `linear-gradient(180deg, rgba(30,122,82,.055), rgba(30,122,82,.02))`

### Dark mode ("Ivy", from 6c)
- Background `#0C0F0C` (green-cast near-black) · elevated surface `#141813` · sheet surface `#0F120F` · ink `#EFEDE2` (bone)
- Ink opacities: `.72 / .66 / .5 / .4 / .34 / .28`
- Hairlines: section `rgba(239,237,226,.12)`, column `.08`, row `.07`
- Accent ivy `#6CAB86` · deep ivy `#3A6B51` · negative red `#C86A5A`
- Accent band: borders `rgba(108,171,134,.28)`, bg gradient `rgba(108,171,134,.06) → .025`

### State color rules (both modes)
- Sleep: >7h green, 6–7h amber (`#A8842B` light / `#C9A45C` dark), <6h red
- Habits: >3/6 green, else amber
- Money: inflows/positive green, outflows/negative red (debt value red)
- Times & dates: **always ink at an opacity, never colored**
- Times are 12-hour format ("1:16 PM"), timeline time column 58pt wide

### Typography
- **Manrope** (UI): screen title 16/600/-.02em · body/status 13/1.5 at ink .64–.66 · band title 21/700/-.025em · row title 14/500 · chips 11.5/500
- **Geist Mono** (all data, labels, times): hero value 30–34/600/-.03em · stat value 20/600/-.01em · week-cell date 13/600 · time 11 · sub/eyebrow 9.5/500 ls .24em (right stat ls .08em) · section header 10.5 ls .26em at ink .72 · band label 8.5 ls .2em accent color · tag 8.5 ls .12em ink .34 · tab label 7.5 ls .16em · wordmark 10 ls .34em ink .5
- All mono labels UPPERCASE.

### Spacing & structure
- Screen: 390pt wide, 24pt gutters; full-bleed bands (border spans edge to edge, content padded 24)
- Status bar: 15pt top, 30pt sides. Header row (wordmark + spark button 34×34) at 24pt. Eyebrow row at 26pt below header; screen title block 20–22pt below that.
- Bands: padding ~15–19pt vertical; 3-col stat grids share the row with column hairlines; ledger rows `grid 58pt | 1fr | auto`, 12pt gap, 12pt vertical padding.
- Tab bar: top hairline via shadow, five slots — Home, Body, center capture button (50×50, r14, elevated surface, ring, "+" icon), Money, Focus. Active tab: 16×2 accent tick above icon, icon ink, label ink .72. Inactive: ink .38 (light) / .34 (dark). Home-indicator bar 134×5 r999 ink .28.
- Radii: phone 46 (device only) · capture 14 · week cells 8 · pills/chips 999. Bars: day 2pt, session/burn 3pt, r999.

### Motion (Reanimated)
- Entrance: fadeUp (14pt rise + fade), 600ms cubic-bezier(.22,.7,.25,1), staggered per band: .02/.07/.12/.19/.25/.31/.37/.43s
- Bar fills (day %, burn, session progress): width 0→N%, 1.1–1.3s, ~.45–.5s delay
- Recovery dial: SVG arc (semicircle r58, stroke 5, round caps, dasharray 182.2) animating dashoffset 182.2→51 (72%), 1.6s cubic-bezier(.16,1,.3,1)
- HRV/sparkline: line draw via dashoffset, 1.5s; bars scaleY from 0, .6s, .06s stagger
- Live-session progress bar: a 56pt light streak sweeps across the filled portion every 3s (2s initial delay)
- One pulse max per screen (the live element only)

## Screens / Views

### Home (6b/6c)
Top→bottom: status bar · header (MAX OS wordmark + spark button) · eyebrow "FRIDAY · MAY 8" + right "DAY 55%" (both ink .5) over a 2pt day-progress bar (grey ink fill, 55%, endpoint dot) · greeting "Good afternoon, Max." + status line ("Recovery's **green** and your afternoon is clear until the **Sequoia call**.") · **FOCUS live band** (accent borders/gradient; label FOCUS + time 1:16 PM; title "Deep work — pricing model" 21/700; sub "44 MIN IN · ENDS 3:00 PM"; 3pt progress 42% with shimmer) · **RECOVERY band** (accent-tint borders; semicircle dial with 72 centered under it; right column: HRV · 7D label, 7 mini bars (14/17/12/19/16/21/26pt, last solid accent), "64 MS · REST 48") · **3-col vitals** SLEEP 7:12 (87% QUAL) / NET WORTH $2.83M (+0.03% · 30D) / HABITS 4/6 (6 pips, 4 accent) — values 20/600 ink except sleep stays ink here · **TODAY ledger** ("8 EVENTS · 3 DONE"): done rows (accent-deep square dot, struck-through title at ink .5, time ink .34, tag OPS/CAL/BODY) then upcoming (outlined square dot, ink .72, times ink .5, tags FOCUS/HABIT) · tab bar (Home active).

### Body (7a)
Eyebrow right: "WEEK 19". Title "Body" + status. **RECOVERY band** (same dial/HRV as home). **TRAINING · DONE accent band**: time 11:00 AM (accent in dark, ink in light), "Push day — 4 PRs", "52 MIN · TONNAGE 12,480 LB". **SLEEP · LAST NIGHT band**: right "10:58 PM → 6:10 AM"; 7:12 at 30/600 **in accent green** + "87% QUALITY"; stage bar 6pt (deep 16.7% deep-green, REM 25% accent, core flex accent-tint .28/.32); legend "DEEP 1:12 REM 1:48 CORE 4:12". **3-col vitals**: REST HR 48 (−2 · 7D) / HRV 64 (**↑ +6 VS AVG** in accent) / WEIGHT 182.4 (−0.6 · 30D). **THIS WEEK · 4 SESSIONS**: 7 blocks 22pt r4 — M,T,T,F filled accent (F ringed + label ink .72), W,S,S track. Tab: Body active.

### Money (7b)
Eyebrow right: "RUNWAY 34 MO". Title "Money" + "Net worth's **steady** and May spend is on pace." **NET WORTH band** (ink hairlines, not accent): $2.83M at 30/600 **accent green**, sub "+$847 TODAY · +0.03% 30D" accent; right 118×34 sparkline (draw-in, endpoint dot). **3-col accounts**: CASH $412K (LIQUID) / INVESTED $2.31M (+1.2% · 30D accent) / DEBT **−$104K in red** (MORTGAGE). **MAY BURN band**: right "ON PACE" accent; "$8.4K OF $12K" + "$3.6K LEFT"; 3pt bar 70% accent. **RECENT ledger** (TODAY · YDA): 11:42 AM "Acme Ltd · wire in" **+$12,500** green 12/600 · 9:15 AM Blue Bottle −$7.40 red · YDA Equinox −$210 · YDA AWS −$1,842 (times ink, YDA ink .34; amounts mono 12). Tab: Money active.

### Focus (7c)
Eyebrow right: "3:12 DEEP TODAY". Title "Focus" + "Two blocks left — **protect the afternoon**." **LIVE · DEEP WORK accent band**: timer 44:12 at 34/600 ink + right "ENDS 3:00 PM"; sub "Deep work — pricing model" 13/500; 3pt progress 42% + shimmer. **3-col stats**: SESSIONS 3/4 (1 LEFT) / DEEP HRS 3:12 (GOAL 4:00) / STREAK **12** accent (DAYS). **THIS WEEK calendar strip** ("MAY 4–10 · AVG 2:54"): 7 cells r8 ringed (ink .08 light / bone .1 dark); each = weekday letter 8pt, date 13/600, deep hours 8pt in accent at ~.75–.8 (2:05/2:50/1:20/3:05); today (F 8) fully accent ringed + accent-tinted bg + 3:12; weekend upcoming dimmed (date ink .34, "—"). **QUEUE ledger** (3 LEFT): 3:00 PM Sequoia call CAL / 5:00 PM Review compliance checklist TASK / 7:00 PM Wind-down · journal HABIT. Tab: Focus active (pen/lamp icon).

### Assistant sheet (8a)
Trigger: the **spark button** (34×34 circle, elevated surface, accent-tinted ring `rgba(30,122,82,.35)` light / `rgba(108,171,134,.4)` dark) holding a four-point spark SVG (`M12 3.5c.7 4.2 2.8 6.3 7 7-4.2.7-6.3 2.8-7 7-.7-4.2-2.8-6.3-7-7 4.2-.7 6.3-2.8 7-7Z` + small satellite dot at 19.4,4.6 at 50% opacity) in accent. It replaces the avatar top-right on **every screen**.
Sheet: slides up over a scrim (`rgba(15,17,21,.38)` light / `rgba(0,0,0,.55)` dark), surface `#F5F3ED` / `#0F120F`, top radius 22, grabber 36×4. Content:
1. Header: spark 19pt + "ASSISTANT" 10 ls .3em + close circle 30pt
2. Briefing: "You're on pace, Max." 16/600 + one-line cross-domain synthesis 13/1.5
3. **TOP MOVE · CAL + BODY** accent band: "Shift tomorrow's training to 4 PM" 15/600, evidence "SEQUOIA FOLLOW-UP LIKELY 10 AM · HRV TRENDING UP" 9 ls .08em ink .5, buttons APPLY (filled accent pill; text `#F5F3ED` light / `#0C0F0C` dark) + LATER (outlined pill ink .6)
4. **ALSO SEEING (3)** ledger, rows `52pt tag | 1fr | action pill`: FOCUS "Block 30 min to prep the call" (BEFORE 3:00 PM → BLOCK pill accent-outlined) / MONEY "AWS is up 18% vs April" (−$1,842 YDA → VIEW) / HABIT "Journal streak at risk" (2 HABITS LEFT TODAY → 7:00 PM)
5. Suggestion chips: "Plan tomorrow" / "Where's my money going?" / "How's my sleep trending?" — 11.5/500 outlined pills
6. Ask bar: pill input (elevated surface, inset ring), placeholder "Ask anything — I have the full picture" ink .38, 34pt accent send circle with up arrow
Sheet sections stagger in (.05/.12/.19/.26/.33/.4s).

## Interactions & Behavior
- Tab bar switches surfaces; center "+" is quick-capture (not designed yet — stub it)
- Spark button opens the assistant sheet (slide-up + scrim fade, ~550ms, same bezier); grabber/close/scrim dismiss
- TOP MOVE: APPLY executes the calendar change, LATER dismisses; row actions: BLOCK creates a focus block, VIEW deep-links to Money, 7:00 PM links the habit
- Entrance choreography runs on every screen mount; live progress bars tick in real time
- Struck-through = completed; upcoming rows tappable → detail (out of scope)
- Light/dark follows system color scheme

## State Management
- Domain stores: body (recovery score, HRV series, sleep, sessions), money (net worth series, accounts, budget, transactions), focus (live session w/ start/end, queue, streak, per-day deep hours), habits (n/6)
- Live session timer derived from start/end timestamps; day-progress % from wake/sleep window
- Assistant: briefing + ranked recommendations derived from all stores (server/LLM); each rec = {domain tag, title, evidence, action}
- Theme: system light/dark

## Assets
No raster assets. All icons are inline SVG in the reference file (~20pt, stroke 1.5–1.6, round caps): home, body silhouette, dollar, pen/lamp (focus), plus, spark, send arrow. Fonts: Manrope + Geist Mono (Google Fonts in the prototype; use expo-google-fonts / bundled fonts).

## Files
- `Personal OS - Home.dc.html` — the full design canvas (open in a browser; sections #t6, #t7, #t8 are the locked spec)
- `system-tokens.md` — condensed token/state reference kept during design
- `home-4-sleek.html` / `home-4-sleek.png` — the user's original starting point (context only)
