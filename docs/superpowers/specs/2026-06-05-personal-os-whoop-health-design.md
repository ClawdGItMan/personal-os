# Phase 1B · Slice — Whoop (Health Metrics + Workouts)

> ℹ **2026-06-08 — also surfaces in the native iOS mobile app.** Personal OS is adding a full native
> iOS app (React Native + Swift) as the primary mobile surface. This integration's backend (OAuth
> token store, sync engine, schema, observability) is **client-agnostic and reused unchanged** — the
> native app is a new client. The native-app delta is UI + a mobile OAuth flow, not new backend. See
> `2026-06-08-personal-os-native-mobile-app-design.md`.

**Status:** Design (approved direction 2026-06-05; pending reviewed spec + plan)
**Date:** 2026-06-05
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations)
**Builds on:** the 1B.1a connection foundation (`docs/superpowers/specs/2026-06-02-personal-os-1b1-google-calendar-gmail-design.md` + plan `docs/superpowers/plans/2026-06-03-personal-os-1b1a-google-oauth-calendar.md`) — encrypted token store, `integrations` table, connect/callback pattern, Vercel cron, live Connections row, reconnect banner + stale chip.

---

## 1. Goal / Outcome

Max connects **Whoop** once from Settings (the same one-click flow as Google). After that, the dashboard **Health view** renders his real daily **Recovery score, day Strain, Sleep (score + hours), HRV, and resting HR**, and his **workouts** (type, duration, strain, heart-rate) appear as an **Activity section on the Train page** — all kept fresh by an **hourly** background sync. Workouts land in a new **provider-agnostic `workouts` table** (source-tagged), so when Strava or Apple Health arrive they feed the same table rather than a Whoop-only one — important because not every user has Strava. This slice also **generalizes the connection foundation to be provider-agnostic**, so the remaining health/finance integrations reuse it instead of copying the Google code.

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Provider | **Whoop**, OAuth 2.0 | Reuses the 1B.1a OAuth foundation almost entirely; high daily-driver health value. |
| Scope (v1) | **Daily health metrics** (recovery, strain, sleep, HRV, RHR) **+ workouts** | Metrics fit `health_snapshots` with no migration; workouts need **one new provider-agnostic table**. |
| Workouts | **In scope** — Whoop workouts → new **provider-agnostic `workouts` table** (source-tagged), shown as an Activity section on Train | Not all users use Strava, so Whoop must be able to supply workouts; the shared table is the multi-source landing zone Strava/Apple Health reuse later. |
| Landing | Existing `health_snapshots`, `source='whoop'`, upsert on `(user_id, date)` with **per-column merge** | Table already has the columns + `'whoop'` source; multiple sources share the daily row. |
| Sync engine | **Vercel Cron, hourly** | Whoop data updates ~once/day (after sleep); hourly is fresh + cheap (vs Google's 5-min). |
| Token handling | **Persist the rotated refresh token on every refresh** | Whoop rotates (single-use) refresh tokens, unlike Google — mishandling silently kills the connection. |
| Foundation | **Lightly generalize** the token store + connection-row to be provider-aware; **leave the live Google integration untouched** | Pays down the "reusable foundation" promise for Whoop + Strava/Apple Health/Plaid. |

## 3. Landing zones

### 3a. Daily metrics → existing `health_snapshots` (no migration — verified)

`public.health_snapshots` (`20260527120007`): `date`, `sleep_score`, `sleep_hours`, `recovery_score`, `strain`, `hrv`, `rhr`, `weight`, `steps`, `vo2_max`, `source ∈ {manual, whoop, apple_health, oura}`, `unique(user_id, date)`, full RLS. **One row per day, source-priority resolved at write time.**

**Mapping:** Whoop recovery score → `recovery_score`; day strain → `strain`; sleep performance % → `sleep_score`; sleep duration (h) → `sleep_hours`; HRV → `hrv`; resting HR → `rhr`. **The mapper must round to each column's precision** — `recovery_score`/`sleep_score`/`hrv`/`rhr` are integers (Whoop returns fractional %/ms), `strain` is `numeric(4,1)` (Whoop's 0–21 scale fits comfortably).

**Merge policy (important — single-statement, atomic):** because multiple sources share the `(user_id, date)` row, a Whoop sync must **upsert a payload containing ONLY the Whoop-owned columns** (`user_id, date, recovery_score, strain, sleep_score, sleep_hours, hrv, rhr, source='whoop'`) with `onConflict: 'user_id,date'`. Postgres `ON CONFLICT DO UPDATE` only sets the columns present in the payload, so `weight`/`steps`/`vo2_max` (manual or later Apple Health) are **preserved untouched in one atomic statement** — no read-merge-write (which would race a concurrent manual write). Do NOT do a blind full-row upsert (the 1B.1a `calendar_events` pattern), which would null the other sources' columns.

### 3b. Workouts → new `workouts` table (one migration)

Whoop workouts (and later Strava / Apple Health) don't fit the strength-training `training_sessions`/`lifts` tables, so add a small **provider-agnostic** table:

```
public.workouts (
  id uuid pk,  user_id uuid not null → auth.users on delete cascade,
  source text not null check (source in ('manual','whoop','strava','apple_health')),
  external_id text,                  -- provider workout id; null for manual
  sport text not null default '',    -- normalized activity type (running, cycling, strength, …)
  started_at timestamptz not null,  ended_at timestamptz,
  duration_sec integer,
  strain numeric(4,1),               -- Whoop-specific; nullable
  avg_hr integer,  max_hr integer,
  energy_kj numeric(8,1),            -- Whoop reports kilojoules; nullable
  distance_m numeric(10,1),          -- Strava/runs later; nullable
  source_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)   -- idempotent provider upserts; manual rows keep external_id null
)
```

Full RLS (own-row select/insert/update/delete, mirroring the other tables) + index `(user_id, started_at desc)`. Whoop fills sport/started/ended/duration/strain/avg_hr/max_hr/energy_kj; source-specific fields (distance_m, …) stay null until another source provides them. **Unlike the shared daily health row, a blind upsert is correct here** — each workout row is owned by exactly one `(source, external_id)`, so `onConflict: 'user_id,source,external_id'` (the `calendar_events` pattern) is right; there's no cross-source column to clobber.

## 4. Components

- **Whoop OAuth lib** — consent URL, code exchange, refresh. Scopes: `read:recovery read:sleep read:cycles read:workout read:profile offline` (verify exact strings + endpoints against current `developer.whoop.com` docs at build time). Unlike Google's `refreshAccessToken` (which discards the response `refresh_token`), the Whoop refresh **must return the new `refresh_token`** so it can be persisted.
- **Provider-generalized token store** — parameterize the 1B.1a store by `provider`. Two first-class store changes (each unit-tested):
  - **Rotating refresh token (blocker-grade):** Whoop refresh tokens are single-use. On refresh, **persist the new refresh token (encrypted) BEFORE using the new access token**, so a failed DB write can't leave us holding a server-invalidated old token (which would permanently brick the connection). Any refresh failure flips `status='expired'` (→ reconnect banner). The hourly cron and the inline backfill must **not refresh concurrently** for the same user (serialize, or let the backfill complete before the cron path can run).
  - **Metadata merge (foundation fix):** the existing persist does `metadata: { expires_at }`, replacing the whole JSONB blob. The generalized persist must **spread existing metadata** (Whoop will store e.g. its user id there); this also quietly fixes the latent Google clobber.
- **Whoop sync core** — for the window: (a) fetch recovery/sleep/cycle → map (rounded) → **partial merge-upsert** (§3a) into `health_snapshots`; (b) fetch workouts → map → **upsert** into `workouts` (§3b, `onConflict: 'user_id,source,external_id'`). Stamp `last_synced_at`, log `sync_runs`/`error_events` (reuse 1B.1a observability). One sync run covers both; partial failure of one stream is logged without failing the other.
- **Routes** — `GET /api/whoop/connect`, `GET /api/whoop/callback` (mirror Google: CSRF state cookie named **`whoop_oauth_state`** so it can't collide with `google_oauth_state`; inline backfill), `GET /api/whoop/sync` (cron; **reuse the existing `timingSafeEqual` constant-time `CRON_SECRET` check** — do not regress to a naive `===`).
- **Live Whoop connection row** — generalize the connection row to a provider-aware component; wire it into `ConnectionsCard`. **Prefer adding `whoop`-keyed store functions/rows over mutating the live Google `GOOGLE_PROVIDER` call sites in place** — the existing Google unit tests must still pass unchanged.
- **Health surfacing (likely already done — verify first):** the Health page already renders Recovery (hero ring), Sleep, Strain, HRV, Weight, Steps from the latest `health_snapshots` row. So once the merge populates the row, **the page may need no changes at all.** Scope this as "confirm the page renders Whoop-populated rows; adjust copy only if needed," NOT a rebuild. A recovery/strain/sleep **trend sparkline** (the page only sparklines HRV/weight/steps today) is genuinely net-new — make it a **separate, optional task**, not bundled into "surfacing."
- **Train Activity section (new UI)** — a compact list on the Train page rendering recent `workouts` rows (sport, time, duration, strain, avg HR), kept **distinct from the manually-logged strength sessions**. Reads the `workouts` table (RLS, cookie client). This is the one genuinely-new screen element in the slice.
- **Backfill** — ~30 days of daily metrics **and recent workouts** on connect so the dashboard has history immediately.

## 5. Sync & data-flow architecture

- **Single write path**, source-tagged `whoop`. Daily metrics **idempotent per `(user_id, date)`** via per-column merge (never clobber other sources); workouts **idempotent per `(user_id, source, external_id)`** via plain upsert (each row single-source-owned).
- **Hourly cron** uses the service-role admin client (no user cookie) and is explicitly scoped by `user_id`; guarded by `CRON_SECRET`.
- **Freshness/health** — `integrations.last_synced_at` + `status` drive the existing reconnect banner + stale chip; on auth failure → `status='expired'`, banner appears within ~1 sync cycle.

## 6. New environment variables

| Var | Purpose |
|---|---|
| `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` | Whoop OAuth app credentials |
| `WHOOP_OAUTH_REDIRECT_URI` | `https://personal-os-azure-eight.vercel.app/api/whoop/callback` |

Reuses existing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

## 7. Security

- Tokens encrypted at rest (reuse AES-256-GCM); **rotated refresh token persisted (write-before-use)** each cycle; never logged.
- Read-only scopes; sync route rejects requests without the correct `CRON_SECRET` (constant-time check).
- RLS enforced on `health_snapshots`; integration + cron writes still pass `user_id`. The service-role cron path bypasses RLS, so **every admin-client read/write must explicitly filter `user_id`** — do not copy the cookie-client Health-page pattern (which relies on RLS) into any admin/service-role query.
- Distinct CSRF cookie (`whoop_oauth_state`); disconnect deletes the integration row (zeroes tokens) and flips status.

## 8. Acceptance gate

> Connect Whoop via `/settings` → backfill lands recovery/sleep/strain rows into `health_snapshots` **and recent workouts into `workouts`** → the **Health view shows real Whoop data** and the **Train Activity section shows real workouts** (web + mobile) → at least one hourly cron sync updates the current day → disconnect/reconnect works → revoke access at Whoop and confirm the reconnect banner appears within ~1 sync cycle.
>
> **Merge contract test:** enter a manual `weight` for today, then run a Whoop sync, and confirm the **weight survives** (not nulled) while recovery/strain populate the same row.
>
> **Google regression check (refresh, not just render):** the foundation generalization must not break the live Google path. Beyond "events still render," **force a Google token refresh** (wait past the ~1h access-token expiry, or revoke+rotate) and confirm calendar still syncs — the refresh path is where a generalization regression would actually surface. Existing Google unit tests must pass unchanged.

## 9. Out of scope (deferred)

- Whoop real-time webhooks (polling is enough), body measurements, detailed sleep stages, per-workout HR-zone breakdowns / GPS routes (store summary fields only).
- Strava, Apple Health, Plaid — separate slices that will reuse the `workouts` table + the generalized foundation. Gmail remains parked.

## 10. Max's one-time setup (~15 min — provide click-by-click at build)

Whoop developer dashboard (`developer.whoop.com`) → create an app → copy **Client ID / Secret** → set redirect URI `https://personal-os-azure-eight.vercel.app/api/whoop/callback` (+ `http://localhost:3000/api/whoop/callback`) → enable the read scopes above → set `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_OAUTH_REDIRECT_URI` in Vercel → redeploy.

## 11. Open items to resolve at planning time

- Exact Whoop API version (v1/v2) endpoints, scope strings, and token-rotation behavior — **verify against current `developer.whoop.com` docs**; do not trust training data.
- Whoop returns per-**cycle**/per-sleep records; define how a cycle maps to a calendar `date` (timezone handling via `profiles.timezone`) — a sleep crossing midnight must land on the intended day; **unit-test this boundary**.
- Workout `sport` normalization: map Whoop's sport-id enum → a readable `sport` string (build a small lookup at plan time); decide energy units (Whoop reports **kilojoules** → store `energy_kj`, render kcal in UI if desired) and whether to surface `strain` per workout.
- **Plan-time guardrails (from spec review):** (a) **drop any synced workout lacking a non-null `external_id`** — never insert a NULL-id provider row, or it duplicates on every sync (NULLs are distinct in the unique index); (b) a **workouts-stream fetch failure must keep `integrations.status='connected'` and record a `partial` sync_run** — only a 401/refresh failure flips to `expired` (so a data hiccup never spuriously raises the reconnect banner); (c) tag the failing stream in `error_events.context` (e.g. `{ stage: 'syncWorkouts' }`, mirroring `{ stage: 'syncCalendar' }`) so a `partial` run is debuggable.
- Generalization seam: how much of the store / connection-row to parameterize vs. duplicate — keep the Google path green (the plan must include a Google regression check).
- Health page display: **verify first** that the existing Health page already renders Recovery (hero ring) / Sleep / Strain / HRV / Weight / Steps from the latest `health_snapshots` row (the reviewer found it does). If so, the only UI work is an optional recovery/strain/sleep trend sparkline — confirm with Max whether that's wanted before scoping it as a task.
