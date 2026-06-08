---
title: Personal OS — Native iOS Mobile App — Design Direction
date: 2026-06-08
owner: Max Allaire
status: Direction approved 2026-06-08 — detailed UI/UX to be iterated in Figma, then built React Native + Swift (Max-directed)
supersedes: 2026-05-21-personal-os-design.md §1.3 (native-iOS non-goal) and §6.5 (Health Auto Export); deprecates the Apple Health HAE ingest slice (spec + plan dated 2026-06-05)
---

# Personal OS — Native iOS Mobile App — Design Direction

> **What this document is.** A *direction* doc, not a finished spec. It records a strategic
> platform decision made 2026-06-08, the architecture implications, and the **Figma-driven design
> workflow** we'll use to flesh out the actual screens. The detailed UI/UX (screens, flows, visual
> language) is deliberately **left open** here — it gets designed iteratively in Figma (see §5),
> then translated to React Native code. This doc is the seed that workflow grows from.

---

## 0. Why this exists

Personal OS shipped Phase 1 as a **Next.js PWA** (web + installable-on-iPhone), and it's live in
production with real integrations (Google Calendar, Whoop). That web product stays live and remains
the source of truth while the native app is designed and built — nothing is being torn down.

The decision to add a native app comes from one hard constraint and one quality judgment:

1. **Apple Health is native-only.** HealthKit data can only be read by a native iOS app the user
   grants permission to — there is no web/cloud API for it. The Phase-1 workaround was
   **Health Auto Export (HAE)**: a paid third-party iOS app the user installs and configures to
   push HealthKit data to our ingest endpoint. It works, but it's a clunky dependency (every user
   must buy + configure a separate app) and, per Max's hands-on assessment, **not robust enough to
   iterate on** — even a developer build of the browser/PWA path can't reach HealthKit directly.
2. **A real native app is the right long-term mobile surface.** Going native (Xcode-developed,
   first-party) unlocks direct HealthKit access via Swift, a genuinely native mobile UX, and a path
   to App Store presence — instead of bending a web app around mobile limits.

So the platform direction expands from "single PWA" to **two surfaces sharing one backend**.

---

## 1. The decision (2026-06-08)

| Decision | Choice |
|---|---|
| Build a native iOS app | **Yes** — full native mobile app for Personal OS, the **primary mobile surface** going forward |
| Tech | **React Native + Swift**, developed directly in **Xcode** |
| Scope | The **full app** with the **planned integrations** (not a narrow health-only companion) |
| Apple Health | **HAE is deprecated.** The native app reads HealthKit directly (Swift); native HealthKit becomes the **sole** Apple Health route (see §3) |
| Web PWA | **Stays live** as the web surface + current source of truth; not retired |
| Design process | **Iterated in Figma first** (§5), then translated to React Native |
| Build ownership | **Max-directed, prompt-driven.** Claude assists step-by-step on Max's prompts; Claude does **not** build the app autonomously/unassisted |

**Eyes-open implication (recorded deliberately):** this introduces a **second codebase** (React
Native + Swift) alongside the existing Next.js web app — a real ongoing-maintenance commitment, a
new toolchain (Xcode, CocoaPods/SPM, RN), and an **Apple Developer account ($99/yr)** + App Store
review pipeline. That cost is accepted as the price of first-party HealthKit + a native mobile
product.

---

## 2. Two-surface architecture (the backend is reused, not rebuilt)

The single most important reassurance: **the integration work done so far is not thrown away.**
Everything behind the API is **client-agnostic** and is reused by the native app. The native app is
a **new client**, not a backend rewrite.

```
        ┌─────────────────────────┐     ┌─────────────────────────┐
        │   Web PWA (Next.js)     │     │  Native iOS app          │
        │   — live, source of     │     │  (React Native + Swift)  │
        │     truth today         │     │  — new primary mobile    │
        └───────────┬─────────────┘     └───────────┬─────────────┘
                    │                                │
                    │   same Supabase auth + same    │
                    │   Next.js API routes + same DB │
                    ▼                                ▼
        ┌───────────────────────────────────────────────────────┐
        │  EXISTING BACKEND (reused unchanged):                  │
        │   • Supabase Postgres + Auth + RLS (all module tables) │
        │   • OAuth token store (AES-256-GCM), provider-aware    │
        │   • Sync engines + Vercel crons (Whoop/Strava/GCal/X)  │
        │   • Landing zones: health_snapshots, workouts, …       │
        │   • Observability: sync_runs, error_events             │
        └───────────────────────────────────────────────────────┘
```

**Reused unchanged:** the Supabase schema, RLS, the provider-aware token store, every cloud-API
integration's sync engine (Whoop, Strava, Google Calendar, X all have cloud APIs — they work
identically regardless of which client triggered the connect), the data landing zones, and the
observability tables.

**What's genuinely new for the native app:**
- A **React Native UI layer** (the app's screens — designed in Figma per §5).
- A **Swift HealthKit module** that reads Apple Health on-device and writes into the existing
  `health_snapshots` / `workouts` landing zones (replacing HAE — see §3).
- **Mobile auth + mobile OAuth flows** (token-based Supabase session instead of web cookies;
  in-app OAuth instead of web redirects — see §7).

---

## 3. Apple Health: HAE → native HealthKit

**Health Auto Export is deprecated.** The shipped HAE ingest path
(`POST /api/apple-health/ingest`, the per-user ingest token, the `AppleHealthConnectionRow`) is
marked **end-of-life**: it stays in prod only until the native app's HealthKit path is live, then
the ingest route + token UI are removed. The native app becomes the **sole** Apple Health route.

**Replacement:** the native app's **Swift HealthKit module** requests HealthKit read permission
on-device, reads the same metric set (steps, active energy, RHR, HRV, sleep, body weight) +
workouts, and writes them into the **same** `health_snapshots` (partial-merge on `user_id,date`)
and `workouts` (upsert on `user_id,source,external_id`) landing zones, **still source-tagged
`apple_health`**. The mappers, merge contract, and multi-source coexistence with Whoop are
**unchanged** — only the *transport* changes (on-device HealthKit read instead of HAE REST push).

**Interim consequence (accepted):** once HAE is removed, **Apple Health has no working path until
the native HealthKit module ships.** Max chose "deprecate" knowing this gap. Whoop continues to
cover recovery/sleep/strain/HRV/RHR in the meantime; the gap is steps / active energy / body weight
on non-Whoop days until native lands.

---

## 4. Integrations in the native app

The native app surfaces the **planned integrations** — the same ones already built or in flight,
reading from the shared backend. Current status:

| Integration | Backend status | In native app |
|---|---|---|
| Google Calendar | **Live in prod** (OAuth + cron) | Yes — reuses backend; mobile OAuth flow needed |
| Whoop | **Live in prod** (OAuth + cron) | Yes — reuses backend; mobile OAuth flow needed |
| Strava | Merged, dormant (awaits Max's pre-flight) | Yes — reuses backend; mobile OAuth flow needed |
| Apple Health | HAE merged+dormant → **moving to native HealthKit** (§3) | Yes — native Swift module (the headline change) |
| X (Twitter) | Greenlit, building (PKCE) | Yes — reuses backend; mobile OAuth flow needed |
| Gmail | Parked (revisit w/ Phase-2 agent) | Later, with the agent |
| Plaid | **Max building it himself** (paused for formal docs/website) | Yes when ready — reuses backend |

The native-app work for the cloud-API integrations (Whoop/Strava/GCal/X/Plaid) is almost entirely
**UI + a mobile OAuth flow** — the connect/sync/token machinery already exists server-side.

---

## 5. The Figma-driven design workflow

The app's UI/UX is designed **in Figma first**, iteratively, before it becomes code. This is the
process Max wants and it's the heart of how we'll work on this:

```
  (1) Discuss direction in chat ──► (2) Claude generates a BASE Figma file
        ▲                                      │
        │                                      ▼
  (5) Claude translates the          (3) Max refines directly in Figma
      approved design → React Native        │
      code (design-to-code)                 ▼
        ▲                            (4) Max shares the Figma back to Claude
        └──────────────────────────────────┘   (Claude reads it via the Figma integration)
                     repeat per screen / flow
```

1. **Discuss in chat.** Claude + Max iterate on the design direction conversationally — which
   screens, the information architecture, the visual language (carrying over the existing dark
   design system / tokens where it fits a native context), navigation pattern, per-screen content.
2. **Claude generates a base Figma file.** Using the connected **Figma integration**, Claude
   creates a starting Figma design (frames/screens reflecting the agreed direction) so Max has
   something concrete to react to rather than a blank canvas. *(Max is new to Figma directly — the
   base file is the on-ramp.)*
3. **Max refines in Figma.** Max edits directly in Figma Design — the tool where "make it
   beautiful" actually happens — moving things, restyling, trying layouts.
4. **Max shares it back.** Max sends the Figma file/URL to Claude; Claude reads the current design
   (layout, components, tokens, screenshots) from Figma.
5. **Claude translates to React Native.** Once a screen/flow is approved, Claude implements it as
   React Native components (design-to-code), wired to the shared backend.

Then repeat per screen/flow. **Claude works on Max's prompts** at each step — Max stays the director.

**Tooling note (for Claude):** the Figma integration (MCP) is connected. Creating/reading Figma
designs goes through the dedicated Figma skills (e.g. the figma-use / figma-generate-design skills)
— invoke those at the time, don't free-hand the API. Do **not** generate the base Figma file until
the direction is agreed in step 1.

---

## 6. Build approach

- **Max-directed, prompt-driven.** Unlike the autonomous integration builds, the native app is built
  step-by-step on Max's prompts. Claude does not run an unattended end-to-end build of the app.
- **Design before code, per screen.** No screen gets built in React Native until its Figma design is
  approved (the §5 loop). This keeps the "beautiful design" bar enforced.
- **Web PWA stays live throughout.** It remains the source of truth during the native build; the
  native app reaches parity incrementally, integration by integration / screen by screen.
- **Same quality gates** as the web work where applicable (typecheck, lint, tests) once there's RN
  code to gate.

---

## 7. Key architecture considerations to resolve (not decided here)

These are real and worth flagging now, but they're **build-time decisions** Max will direct — not
locked in this doc:

- **Mobile auth.** The web app uses Supabase magic-link **cookie** sessions. The native app needs a
  **token-based** Supabase session (`@supabase/supabase-js` with secure storage for persistence) —
  magic-link/OTP or another supported flow on mobile. Sessions, refresh, and sign-out differ from
  the web cookie model.
- **Mobile OAuth.** Provider connects currently use **web redirects**
  (`/api/{provider}/connect` → provider → `/api/{provider}/callback`, cookie-scoped). On mobile this
  becomes an **in-app browser** flow (`ASWebAuthenticationSession` / equivalent) with a deep-link
  redirect back into the app. The callback route may need a mobile-aware variant.
- **HealthKit module.** Native Swift HealthKit access — either a hand-rolled Swift native module or
  a maintained RN HealthKit library — reading the §3 metric set + workouts and writing to the shared
  landing zones. Decide build vs. library at implementation.
- **React Native + Supabase.** Well-trodden path, but confirm session persistence (secure storage),
  RLS still keys to `auth.uid()` (unchanged), and how the app calls existing Next.js API routes vs.
  Supabase directly.
- **Navigation / IA.** Native navigation (tab bar + stacks) likely differs from the web 3-zone /
  mobile-single-column shells. The IA gets designed in the Figma loop (§5).
- **Code sharing web ↔ native.** Decide how much (if any) logic/types are shared between the Next.js
  app and the RN app (e.g. shared Zod schemas / types) vs. kept separate. Default: keep separate
  unless a clean shared package emerges.
- **Offline / push / background.** Native unlocks proper push + background — out of scope for the
  first pass, but native removes the iOS-PWA limits previously flagged as risks.
- **Apple Developer account + App Store.** $99/yr account, signing, TestFlight for iterating,
  eventual review. Max's to set up as a prerequisite.

---

## 8. Open design questions (for the Figma iteration)

To resolve conversationally in step (1) of the §5 loop before generating the base Figma file:

- Which screens ship first? (Likely: Home/dashboard, Health, Train, then the rest.)
- Does the native app mirror the web module set 1:1, or re-prioritize for mobile?
- How much of the existing dark visual system (tokens, type, the `NN //` module headers, sparklines/
  rings) carries into the native look vs. a more iOS-native treatment?
- Navigation pattern: bottom tab bar? What are the top-level tabs?
- Capture bar / agent placement on mobile (agent is Phase 2, but reserve the space).
- Onboarding / connect flow on first launch (sign in → connect integrations → grant HealthKit).

## 9. Explicitly out of scope for this doc

- Final screen designs (those come from the Figma loop).
- Locking RN libraries, navigation lib, or the HealthKit approach.
- A migration/removal date for the HAE ingest code (removed once native HealthKit is live).
- Android (iOS-first; React Native keeps the door open but Android is not committed).
- The Phase-2 agent's native surface (reserve space; design later).

## 10. Prerequisites (Max's setup, when we start building)

- **Apple Developer account** ($99/yr) for signing + TestFlight + App Store.
- **Xcode** + the React Native toolchain on Max's machine.
- (Design phase needs none of the above — Figma + chat only.)

---

## 11. Status & next step

- **Direction approved** (2026-06-08). HAE deprecation + native-HealthKit replacement recorded.
- **Master spec annotated** (`2026-05-21-personal-os-design.md`): native-iOS non-goal reversed, HAE
  section + Phase-3 native-app line marked superseded → point here.
- **Next:** begin step (1) of the §5 loop — discuss the design direction in chat (screens, IA,
  visual language), then Claude generates the base Figma file for Max to refine.
