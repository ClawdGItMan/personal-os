# Phase 1B · Slice — Strava (Workouts)

**Status:** Design (2026-06-05) — near-clone of the Whoop slice; assumes the **merged** Whoop foundation.
**Date:** 2026-06-05
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations)
**Template (mirror exactly):** `docs/superpowers/specs/2026-06-05-personal-os-whoop-health-design.md` + plan `docs/superpowers/plans/2026-06-05-personal-os-1b2-whoop-health.md`
**Roadmap framing:** `docs/superpowers/plans/2026-06-05-personal-os-integration-parallel-buildout.md` → "Strava (build 1st — near-clone of Whoop)".
**Builds on (must be MERGED first):** the Whoop 1B.2 foundation — provider-aware token store (`getIntegration`/`saveTokens`/`persistRefreshedTokens`/`markStatusFor`/`touchLastSyncedFor` + `buildSaveUpsert`/`buildRefreshUpdate`), the provider-agnostic `workouts` table (`20260605120000_create_workouts.sql`), the generalized `ProviderConnectionRow`, the single-stream sync-core pattern (`src/lib/sync/whoop.ts` Stream B), the Train "Activity" section, and the hourly Vercel cron pattern.

> **Strava API live-doc verification (2026-06-05).** Training data on the Strava API is stale; the facts below were confirmed against current docs at build time. Cited inline and collected in §5/§11.
> - OAuth & token/refresh behavior — https://developers.strava.com/docs/authentication/
> - List Activities endpoint + activity fields — https://developers.strava.com/docs/reference/
> - Rate limits + athlete capacity — https://developers.strava.com/docs/rate-limits/
> - Webhooks (out of scope) — https://developers.strava.com/docs/webhooks/
> - App creation / callback domain — https://developers.strava.com/docs/getting-started/

---

## 1. Goal / Outcome

Max connects **Strava** once from Settings (the same one-click OAuth flow as Google and Whoop). After that, his Strava **activities** (runs, rides, swims, etc.) appear in the **Train page "Activity" section** that already exists — type, time, duration, distance, heart rate — kept fresh by an **hourly** background sync. Activities land in the existing **provider-agnostic `workouts` table** with `source = 'strava'`, alongside any Whoop workouts, with no schema change. This slice is the **near-clone that proves the multi-provider abstraction**: it adds a provider purely through the generalized store + `ProviderConnectionRow` + a single-stream sync, with effectively zero new foundation.

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Provider | **Strava**, OAuth 2.0 authorization-code + refresh | Reuses the merged Whoop OAuth foundation almost entirely. |
| Scope (v1) | **Workouts only** (athlete activities) | No daily-health stream — Strava is an activity tracker. Single sync stream → simplest possible provider. |
| Landing | Existing **`workouts` table**, `source='strava'`, plain upsert on `(user_id, source, external_id)` | Table already has the `'strava'` source + every column we need (incl. `distance_m`). No migration. |
| Surfacing | Existing **Train "Activity" section** | Whoop already built the `ActivityList` + the Train query reading `workouts`; Strava rows just appear in the same list. **No new UI.** |
| Sync engine | **Vercel Cron, hourly** (`0 * * * *`) | Mirrors Whoop. Activities don't need sub-hour freshness; hourly is fresh + well within rate limits. |
| Token handling | **Persist the rotated refresh token on every refresh (write-before-use)** | **Strava rotates refresh tokens** and invalidates the old one immediately — identical hazard to Whoop. Reuse `persistRefreshedTokens` with `refreshToken` passed. ([auth docs](https://developers.strava.com/docs/authentication/)) |
| Scope string | **`activity:read_all`** | `activity:read` excludes "Only You" activities and privacy-zone data; for a personal dashboard the user wants *all their own* activities, so `read_all` is correct. Read-only either way. ([auth docs](https://developers.strava.com/docs/authentication/)) |
| Backfill | **~30 days on connect** | Mirrors Whoop; gives the Activity section immediate history. Comfortably within rate limits (see §5). |
| Foundation | **Add a provider, do not extend the foundation** | The store, sync-core pattern, `ProviderConnectionRow`, `workouts` table, and cron all already exist. Strava is a near-pure consumer. |

## 3. Landing zones

### 3a. Workouts → existing `workouts` table (no migration — verified)

`public.workouts` (`20260605120000_create_workouts.sql`): `id`, `user_id`, `source ∈ {manual,whoop,strava,apple_health}`, `external_id`, `sport text`, `started_at timestamptz`, `ended_at timestamptz`, `duration_sec int`, `strain numeric(4,1)`, `avg_hr int`, `max_hr int`, `energy_kj numeric(8,1)`, `distance_m numeric(10,1)`, `source_metadata jsonb`, `created_at`, `unique (user_id, source, external_id)`, full RLS, index `(user_id, started_at desc)`.

**`'strava'` is already in the source CHECK constraint** and **`distance_m` already exists** (added by Whoop's migration precisely for "Strava/runs later"). So Strava needs **no migration at all** — it writes into the table as-is.

**Idempotency model — plain upsert (same as Whoop Stream B).** Each Strava activity row is owned by exactly one `(source='strava', external_id=<activity id>)`, so a blind upsert with `onConflict: 'user_id,source,external_id'` is correct — there is no cross-source column to clobber (unlike the shared daily `health_snapshots` row, which Strava never touches). Strava fills `sport/started_at/ended_at/duration_sec/avg_hr/max_hr/energy_kj/distance_m`; `strain` stays null (Whoop-specific). **Guardrail (inherited from Whoop):** drop any activity lacking a non-null `external_id` before insert — NULLs are distinct in the unique index and would duplicate on every sync.

### 3b. No daily-metrics stream

Strava has no recovery/sleep/HRV equivalent, so there is **no `health_snapshots` write** in this slice. The two-stream Whoop sync collapses to **one stream** (workouts) — the single most simplifying difference from Whoop. The partial-merge logic that `health_snapshots` requires is therefore irrelevant here.

### 3c. Field mapping table (Strava activity → `workouts` column)

Source: SummaryActivity from `GET /athlete/activities` ([reference docs](https://developers.strava.com/docs/reference/)). Pure `mapActivity(raw)` builds the row; rounding/units below are the **tested contract** (field names confirmed against live docs, but re-verify at build).

| `workouts` column | Strava field | Type / units (Strava) | Transform → column | Notes |
|---|---|---|---|---|
| `external_id` | `id` | Long (activity id) | `String(id)`; **return `null` (drop row) if missing** | Upsert key with `(user_id, source)`. |
| `source` | — | — | constant `'strava'` | Single write path, source-tagged. |
| `sport` | `sport_type` (fallback `type`) | String enum (`Run`, `Ride`, `MountainBikeRide`, `Swim`, `WeightTraining`, `Walk`, …) | normalize via small lookup → lowercase readable (`run`, `ride`, `swim`, `strength`, …); unknown → lowercased raw value | Prefer `sport_type` (newer, finer-grained); fall back to `type`. Build the lookup at plan time from the docs' enum. |
| `started_at` | `start_date` | ISO 8601 **UTC** | store as-is (UTC timestamptz) | The absolute instant — used for ordering. |
| `ended_at` | `start_date` + `elapsed_time` | — | `new Date(start_date).getTime() + elapsed_time*1000` → ISO | Strava has no end field; derive from start + elapsed. |
| `duration_sec` | `moving_time` (fallback `elapsed_time`) | Integer seconds | as-is | `moving_time` is the "active" duration; matches Whoop's notion of workout duration. Use `elapsed_time` if `moving_time` absent. |
| `distance_m` | `distance` | Float **meters** | round to 1 decimal (`numeric(10,1)`) | The Strava-distinct field the `workouts` table was pre-provisioned for. |
| `avg_hr` | `average_heartrate` | Float bpm | `Math.round`; omit if `has_heartrate` false / field absent | Integer column. |
| `max_hr` | `max_heartrate` | Integer bpm | as-is; omit if absent | Already integer. |
| `energy_kj` | `kilojoules` | Float kJ | round to 1 decimal; omit if absent | Same unit as Whoop's `energy_kj` → consistent. **Note:** `calories` is **only on DetailedActivity**, not the list endpoint — do **not** fetch per-activity detail just for calories (rate-limit waste, YAGNI). |
| `strain` | — | — | **null** | Whoop-specific; Strava has no strain. |
| `source_metadata` | `{ sport_type, type, timezone, utc_offset, total_elevation_gain, average_speed, max_speed }` | mixed | small JSON blob of useful extras | Optional; keep it small. Lets future UI show elevation/pace without a migration. |
| `user_id` | — | — | injected by the sync core (not the mapper) | Same as Whoop — mapper is pure; sync adds `user_id`. |

**Timezone / local-day handling.** Strava returns `start_date` (UTC), `start_date_local` (the wall-clock time at the activity location), `timezone` (e.g. `(GMT-08:00) America/Los_Angeles`), and `utc_offset` (seconds). Unlike Whoop (whose daily metrics must be bucketed onto a calendar `date`), `workouts` stores an **absolute `started_at` timestamptz**, not a `date` — so there is **no midnight-boundary date-bucketing problem here**. We store `start_date` (UTC) in `started_at` and render it in the operator's timezone in the UI (the `ActivityList` already formats via `Intl.DateTimeFormat` in the operator timezone). This is simpler than the Whoop date-assignment logic, which does not apply.

## 4. Components

All mirror the Whoop slice's shapes; **the only genuinely new code is the `src/lib/strava/*` lib + `src/lib/sync/strava.ts` + the three routes.** Everything else is reuse.

- **Strava OAuth lib** (`src/lib/strava/oauth.ts`) — mirrors `src/lib/whoop/oauth.ts` / `src/lib/google/oauth.ts`. Auth endpoint `https://www.strava.com/oauth/authorize`, token endpoint `https://www.strava.com/oauth/token`. `STRAVA_SCOPES = ["activity:read_all"]` (comma-delimited per Strava — note Strava uses **comma**-separated scope, not Google's space). `buildConsentUrl(state)` with `response_type=code`, `approval_prompt=force` (force re-consent on reconnect), `scope`, `state`. `exchangeCode(code)` → `{accessToken, refreshToken, expiresAt}` (Strava returns `expires_at` as **epoch seconds** — convert to **epoch ms** to match the store's convention; throw `StravaAuthError` if no `refresh_token`). `refreshTokens(refreshToken)` → **`{accessToken, refreshToken, expiresAt}`** — **Strava rotates the refresh token, so RETURN the new `refresh_token`** (exactly like Whoop; unlike Google). `StravaAuthError extends Error` with `status`/`body`.
- **Strava client** (`src/lib/strava/client.ts`) — `stravaFetch(accessToken, path, params)` → JSON, `Authorization: Bearer`, throws `StravaApiError` (with `status`) on non-OK, truncate error body. **Pagination is page-number based** (`page`/`per_page`), not cursor — loop incrementing `page` until a short page (`< per_page`) is returned. (Mirror the fetch/error shape of Whoop's `client.ts`; the only structural difference is page-number vs `nextToken` pagination.)
- **Strava workouts mapper + fetch** (`src/lib/strava/workouts.ts` + `.test.ts`) — `fetchActivities(accessToken, { after, before })` (paginated; `after`/`before` are **epoch seconds**, `per_page=100`) + pure `mapActivity(raw)` → workouts row **or `null`** per §3c, plus the `STRAVA_SPORTS` lookup. Unit-tested for the field mapping, rounding, kJ, distance, and the **drop-null-id** guard (mirror `whoop/workouts.test.ts`).
- **Strava sync core** (`src/lib/sync/strava.ts`) — **single stream.** Mirror `src/lib/sync/whoop.ts` but with only Stream B: load `getIntegration(client, userId, "strava")`; `readTokens`; **refresh-token guard** (no refresh token → `markStatusFor(..,"expired",..)`); `metadata.expires_at` is epoch **ms** — if past/within 60s of `Date.now()`, `refreshTokens` → `persistRefreshedTokens(client, userId, "strava", refreshed)` **before** using the new access token (write-before-use; Strava's old refresh token is invalidated immediately); also catch a 401 mid-fetch and refresh-retry once. Window: `last_synced_at` ? incremental `[now-2d, now]` : backfill `[now-30d, now]` (as epoch seconds for `after`/`before`). Fetch → `mapActivity` (drop nulls) → add `user_id` → `upsert(rows, { onConflict: "user_id,source,external_id" })`. On auth/refresh failure → `expired` + failed `sync_runs`; on a data/fetch hiccup → keep `status='connected'`, record `error_events` `{ stage: "syncStravaActivities" }` + a `partial`/`failed` `sync_run` (a data hiccup must not raise the reconnect banner). Stamp `touchLastSyncedFor(client, userId, "strava")`; write `sync_runs` `{ provider:"strava", rows_synced, status }`. Return `{ ok, status, synced }`. **(`SYNC_PROVIDER = "strava"` on `sync_runs`/`error_events`.)**
- **Routes** (`src/app/api/strava/{connect,callback,sync}/route.ts`) — mirror the Whoop routes exactly:
  - `GET /api/strava/connect` — `getCurrentUserId` guard, `randomBytes(16).toString("hex")` state, CSRF cookie **`strava_oauth_state`** (distinct so it can't collide with `google_oauth_state` / `whoop_oauth_state`), redirect to `buildConsentUrl(state)`.
  - `GET /api/strava/callback` (`export const maxDuration = 60`) — verify `strava_oauth_state`; `exchangeCode`; `saveTokens(supabase, userId, "strava", tokens, { athlete_id })` (store the Strava athlete id from the token-exchange `athlete` object in metadata); run `syncStrava(supabase, userId)` inline (backfill); redirect `/settings?connected=strava` / `?error=strava` / `?error=strava_state`.
  - `GET /api/strava/sync` (`export const maxDuration = 60`) — **reuse the existing constant-time `CRON_SECRET` check** (`timingSafeEqual` `authMatches` — copy from the Whoop/Google sync route, do **not** regress to `===`); select `integrations` where `provider='strava' AND status='connected'`; call `syncStrava(admin, row.user_id)` per user; count ok/failed.
- **Live Strava connection row** — render a Strava row via the **already-generalized `ProviderConnectionRow`** (`provider="strava"`, `label="Strava"`, `sub="FITNESS"`, `connectPath="/api/strava/connect"`, `syncedLabel` via `staleAgeLabel`). **No new component** — `ProviderConnectionRow` already switches disconnect/sync action by `provider`; just add the `strava` cases to its action switch. Leave `GoogleConnectionRow.tsx` untouched (as the Whoop plan established).
- **Connections actions** (`_actions/connections.ts`) — add `disconnectStrava()` (delete integration where `provider='strava'`, revalidate `/settings` + `/dashboard`) and `syncStravaNow()` (`syncStrava(supabase, userId)`, revalidate `/dashboard` + `/train` + `/settings`), mirroring the Whoop actions.
- **Train Activity section — REUSED, no change.** Whoop already built `src/components/modules/train/ActivityList.tsx` and the Train-page query reading `workouts`. Strava rows land in the same table → they appear automatically. **Verify-only:** confirm the Train query is **provider-agnostic** (selects all `workouts` rows, not filtered to `source='whoop'`). If Whoop's query filtered by source, widen it (one-line change); if it already reads all `workouts`, no change. Optional polish: show `distance` for distance sports (the column is now populated) — flag as a small optional follow-up, not required for acceptance.

## 5. Sync & data-flow architecture

- **Single write path**, source-tagged `strava`, **idempotent per `(user_id, source, external_id)`** via plain upsert (each row single-source-owned). One sync stream (no `health_snapshots` write).
- **Hourly cron** (`0 * * * *`) uses the service-role admin client (no user cookie), explicitly scoped by `user_id`, guarded by the constant-time `CRON_SECRET` check.
- **Freshness/health** — `integrations.last_synced_at` + `status` drive the existing reconnect banner + stale chip; on auth/refresh failure → `status='expired'`, banner appears within ~1 sync cycle. A data-fetch hiccup keeps `status='connected'` (records a `partial`/`failed` sync_run only).
- **Rate-limit budget (verified — [rate-limit docs](https://developers.strava.com/docs/rate-limits/)).** Default new-app limits: **100 reads / 15 min, 1,000 reads / day**. Our usage is tiny: an hourly cron + a 30-day backfill on connect. A 30-day backfill at `per_page=100` is typically **1–3 requests** for a normal athlete; hourly incremental syncs are **1 request each** (≤24/day). We stay far under both windows for the single athlete. **Athlete capacity = 1 by default** ([rate-limit docs](https://developers.strava.com/docs/rate-limits/)) — which is exactly Personal OS's single-user model, so **no rate-limit-increase request is needed** for this slice.
- **Token expiry.** Access tokens expire **6 hours** after creation ([auth docs](https://developers.strava.com/docs/authentication/)) — far longer than Google's ~1h, so most hourly syncs reuse a valid token; the refresh path runs roughly every 6th sync. The refresh path is where the **rotated-refresh-token write-before-use** matters most.
- **Pagination:** page-number (`page`/`per_page`), loop until a short page; **not** Whoop's `nextToken` cursor. `after`/`before` are **epoch seconds** (Strava convention), distinct from the store's epoch-ms `expires_at`.

## 6. New environment variables

| Var | Purpose |
|---|---|
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava API application credentials (strava.com/settings/api) |
| `STRAVA_OAUTH_REDIRECT_URI` | `https://personal-os-azure-eight.vercel.app/api/strava/callback` |

Add env getters `getStravaClientId/Secret/OauthRedirectUri` to `src/lib/env.ts` (mirror the Whoop getters; throw only at call time). Reuses existing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Document in `.env.example`.

## 7. Security

- **Read-only scope** (`activity:read_all` — reads the user's own activities incl. private; no write scope requested). ([auth docs](https://developers.strava.com/docs/authentication/))
- Tokens **encrypted at rest** (reuse AES-256-GCM `src/lib/crypto/tokens.ts`); **rotated refresh token persisted write-before-use** every refresh cycle (Strava invalidates the old one immediately); tokens never logged.
- **RLS** enforced on `workouts` (own-row CRUD). The service-role cron path bypasses RLS, so **every admin-client read/write explicitly filters `user_id`** — do not copy the cookie-client (RLS-relying) Train-page query into the admin/cron path.
- Sync route rejects requests without the correct `CRON_SECRET` (**constant-time** `timingSafeEqual` — reuse, don't regress to `===`).
- **Single write path**, source-tagged `'strava'` — the cron/backfill is the only thing that writes `source='strava'` rows.
- Distinct CSRF cookie **`strava_oauth_state`** (httpOnly, `secure` in prod); disconnect deletes the integration row (zeroes encrypted tokens) and the row returns to NOT CONNECTED. (Optional hardening: call Strava's `POST /oauth/revoke` on disconnect to invalidate the grant server-side — flag as a nice-to-have, not required.)

## 8. Acceptance gate

> Connect Strava via `/settings` → backfill lands recent activities into `workouts` (`source='strava'`) → the **Train Activity section shows real Strava activities** (web + mobile) alongside any Whoop workouts → at least one hourly cron sync picks up a newly-logged activity → disconnect/reconnect works → revoke access at Strava (Settings → My Apps) and confirm the reconnect banner appears within ~1 sync cycle.
>
> **Refresh-path check (the real risk):** wait past the **6-hour** Strava access-token expiry (or force it) and confirm a sync still lands — this exercises the **rotated-refresh-token persist-before-use** path (a botched rotation would permanently brick the connection).
>
> **No-clobber check:** confirm a Strava sync does **not** touch `health_snapshots` (it writes only `workouts`), and that Whoop and Strava workouts **coexist** in the Train Activity list (distinct `(source, external_id)` rows, no collisions).
>
> **Mapper unit tests green:** `mapActivity` rounding/units (distance, kJ, HR), `sport_type`→`sport` normalization, and the **drop-null-id** guard.

## 9. Out of scope (deferred)

- **Strava webhooks / push subscriptions** ([webhook docs](https://developers.strava.com/docs/webhooks/)) — Strava supports a single push subscription (`POST /push_subscriptions`, `hub.challenge` validation handshake) that pushes activity create/update/delete + deauthorization events. **We deliberately use hourly cron-pull instead** to mirror the Whoop pattern and avoid a new inbound public webhook endpoint + verification surface. Webhooks are a future optimization, not v1.
- DetailedActivity-only fields (`calories`, per-split/lap data, `segment_efforts`, GPS streams/polylines, photos, gear) — store summary fields only; do **not** make per-activity detail calls (rate-limit + privacy waste).
- Segments, starred segments, PR efforts, routes, clubs.
- `activity:write` (creating/editing activities) — read-only integration.
- Multi-athlete scaling (athlete capacity > 1 → Strava app review) — single-user model needs capacity 1, already the default.
- Strava `profile:read_all` (weight/FTP) → `health_snapshots` — a possible future small add, not this slice.

## 10. Max's one-time setup (~10 min — click-by-click)

> **Lead time: immediate.** Creating a Strava API application is **instant, self-service, no approval** for the default single-athlete tier ([getting-started docs](https://developers.strava.com/docs/getting-started/)). This is the **easiest pre-flight of the four integrations** — no review queue, unlike Plaid.

1. Sign in to Strava in a browser, go to **https://www.strava.com/settings/api** ("My API Application").
2. Create the application. Fill in:
   - **Application Name:** `Personal OS` (anything).
   - **Category:** pick the closest (e.g. *Data Importer* / *Visualizer*).
   - **Club:** leave blank.
   - **Website:** `https://personal-os-azure-eight.vercel.app`.
   - **Authorization Callback Domain:** **`personal-os-azure-eight.vercel.app`** — this is a **bare domain only, NO `https://` and NO path** ([getting-started docs](https://developers.strava.com/docs/getting-started/) confirms it accepts "localhost or any domain"). Strava matches any redirect URI **under** this domain, so the same app works for both the prod callback and `http://localhost:3000/...` only if the callback domain matches — for local dev, either temporarily set the callback domain to `localhost`, or register a second dev app with callback domain `localhost`. (Production uses the Vercel domain above.)
   - **Application Icon:** upload any small image (required by the form).
3. After saving, the page shows **Client ID** and **Client Secret** (plus an initial access/refresh token pair we don't need — our OAuth flow mints its own). Copy the **Client ID** and **Client Secret**.
4. The redirect URI our app uses (must sit under the callback domain above):
   - Production: `https://personal-os-azure-eight.vercel.app/api/strava/callback`
   - Local: `http://localhost:3000/api/strava/callback`
5. Set in Vercel (Production) **and** `.env.local`:
   - `STRAVA_CLIENT_ID` = the Client ID
   - `STRAVA_CLIENT_SECRET` = the Client Secret
   - `STRAVA_OAUTH_REDIRECT_URI` = `https://personal-os-azure-eight.vercel.app/api/strava/callback` (use the localhost value in `.env.local`)
   - Reuse the already-set `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
6. **Redeploy.** No rate-limit-increase request is needed (athlete capacity 1 is the default and matches the single-user model). Scopes are chosen on the consent screen by our app (`activity:read_all`), not configured in the dashboard.

## 11. Open items to resolve at planning time

- **Confirm Strava field names against live docs at build** — the §3c contract (rounding/units/drop-null-id) is fixed and unit-tested; the raw extraction (`sport_type`, `start_date`, `moving_time`, `kilojoules`, `average_heartrate`, `has_heartrate`, `distance`) was verified 2026-06-05 against https://developers.strava.com/docs/reference/ but re-confirm the exact JSON keys when wiring `mapActivity`.
- **`sport_type` → `sport` lookup** — build the `STRAVA_SPORTS` map at plan time from the docs' `sport_type` enum (Run/Ride/Swim/WeightTraining/Walk/Hike/Workout/…); unknown → lowercased raw value. Decide the small set of normalized strings shared with Whoop's sport vocabulary so the Activity list reads consistently across providers.
- **`type` vs `sport_type`** — `sport_type` is the newer, finer-grained field; prefer it, fall back to `type`. Confirm both are present on SummaryActivity at build.
- **Train query provider-scope** — verify the Whoop-built Train query reads **all** `workouts` (not `source='whoop'`-filtered). Widen if needed (one line). This is the only place a Whoop assumption could block Strava rows from showing.
- **Local-dev callback domain** — Strava's single "Authorization Callback Domain" per app is a real friction for prod + localhost. Decide: (a) one app, flip the callback domain between `localhost` and the Vercel domain as needed, or (b) two apps (one per domain) with separate env values. (b) is cleaner; confirm with Max.
- **Optional distance rendering** — the `distance_m` column will now be populated for runs/rides; decide whether the `ActivityList` shows distance (km/mi) for distance sports. Small optional UI follow-up, not in the acceptance gate.
- **Optional disconnect revocation** — whether to call `POST /oauth/revoke` ([auth docs](https://developers.strava.com/docs/authentication/)) on disconnect to invalidate the grant server-side, vs. just deleting the local row. Nice-to-have hardening.
- **Pagination cap** — set a sane max page count on the backfill loop (e.g. stop after N pages) so a pathological history can't exhaust the rate budget; incremental syncs are naturally tiny.
