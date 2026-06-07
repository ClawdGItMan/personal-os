# Strava Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **You are a fresh session with no prior context. Read this whole plan + the spec before starting.** The Whoop slice (1B.2) is **LIVE / merged in production** and is your working template — mirror its files (`src/lib/whoop/*`, `src/lib/sync/whoop.ts`, the `whoop` routes, `ProviderConnectionRow`, `ActivityList`). Do **NOT** reinvent the foundation and do **NOT** break Whoop or Google (there is a regression gate at the end).
>
> **Before writing ANY Strava API / OAuth code, open the CURRENT docs at https://developers.strava.com and verify endpoints, token rotation, scopes, and JSON field names — your training data for the Strava API is stale.** Specifically confirm, at build time:
> - OAuth + token rotation — https://developers.strava.com/docs/authentication/ (Strava ROTATES the refresh token on every refresh and invalidates the old one immediately; `expires_at` is epoch **seconds**; scopes are **comma**-delimited).
> - List Activities endpoint + field names — https://developers.strava.com/docs/reference/ (`GET /athlete/activities`; `page`/`per_page` pagination; `after`/`before` are epoch **seconds**; SummaryActivity fields `id`, `sport_type`, `type`, `start_date`, `start_date_local`, `timezone`, `utc_offset`, `moving_time`, `elapsed_time`, `distance`, `average_heartrate`, `max_heartrate`, `has_heartrate`, `kilojoules`, `total_elevation_gain`, `average_speed`, `max_speed`).
> - Rate limits — https://developers.strava.com/docs/rate-limits/ (default 100 reads / 15 min, 1,000 / day; athlete capacity 1 — matches our single-user model, no increase needed).
> - App creation / callback domain — https://developers.strava.com/docs/getting-started/ (ONE Authorization Callback Domain per app — see the Pre-flight decision).

**Goal:** Max connects **Strava** once from Settings (the same one-click OAuth flow as Google and Whoop). After that his Strava **activities** (runs, rides, swims, …) appear in the Train page "Activity" section that Whoop already built — type, time, duration, distance, heart rate — kept fresh by an **hourly** Vercel Cron. Activities land in the existing provider-agnostic `workouts` table with `source='strava'`, alongside any Whoop workouts, with **zero schema change**.

**Architecture:** Strava is a **near-pure consumer** of the merged Whoop foundation. It adds a provider through the already-generalized token store (`getIntegration`/`saveTokens`/`persistRefreshedTokens`/`markStatusFor`/`touchLastSyncedFor`, `buildSaveUpsert`/`buildRefreshUpdate` — all provider-parameterized), the AES-256-GCM crypto, the `ProviderConnectionRow` (just add `strava` cases to its action switch), and the existing `ActivityList` + Train query. The only genuinely new code is `src/lib/strava/*` (oauth + client + workouts mapper), `src/lib/sync/strava.ts` (a **single-stream** sync — the biggest simplification vs Whoop's two streams), three routes, and an hourly cron entry. **No migration:** the `workouts` table already whitelists `'strava'` in its source CHECK and already has `distance_m` (added by Whoop's migration precisely for Strava).

**Tech Stack:** Next.js 16 (App Router route handlers), React 19 server components, Supabase (`@supabase/ssr` cookie client + `@supabase/supabase-js` service-role admin client), Node `crypto` (reuse AES-256-GCM token encryption), Zod, Vitest, Playwright, Vercel Cron (Pro).

**Spec:** `docs/superpowers/specs/2026-06-05-personal-os-strava-design.md` (read it — it has the field-mapping contract, token-rotation hazard, single-stream rationale, and the regression rationale).

**Foundation templates (read these first — you will mirror them):**
- `src/lib/integrations/store.ts` — provider-aware token store (reused **as-is**, no change; `Provider` type already `"google" | "whoop"` → widen to include `"strava"`).
- `src/lib/whoop/oauth.ts` — OAuth lib pattern with **rotating refresh** (Task 2 mirrors it; Strava rotates exactly like Whoop).
- `src/lib/whoop/client.ts` — authed fetch + `WhoopApiError` + pagination (Task 3 mirrors the fetch/error shape; pagination differs — page-number not cursor).
- `src/lib/whoop/workouts.ts` + `.test.ts` — fetch + pure mapper + sport lookup + drop-null-id (Task 4 mirrors this exactly).
- `src/lib/sync/whoop.ts` — sync core: refresh-before-use, upsert, `sync_runs`/`error_events` logging (Task 5 mirrors **Stream B only**).
- `src/lib/sync/calendar.ts` — refresh-retry + logging scaffolding reference.
- `src/app/api/whoop/{connect,callback,sync}/route.ts` — the three routes (Tasks 6–8).
- `src/app/(app)/settings/ProviderConnectionRow.tsx`, `ConnectionsCard.tsx`, `_actions/connections.ts` (Task 9).
- `src/components/modules/train/ActivityList.tsx` + `src/app/(app)/train/page.tsx` (Task 10 — verify-only / one-line widen).
- `src/lib/crypto/tokens.ts` (reused as-is), `src/lib/env.ts` (Task 1), `src/lib/supabase/admin.ts` (reused).

---

## Pre-flight — Max's one-time Strava setup (BLOCKS Tasks 6–8 live test; everything else can be built without it)

> **Lead time: immediate.** Creating a Strava API application is **instant, self-service, no approval** for the default single-athlete tier — the easiest pre-flight of the four integrations (unlike Plaid's review queue).

1. Sign in to Strava → **https://www.strava.com/settings/api** ("My API Application").
2. Create the application:
   - **Application Name:** `Personal OS` (anything).
   - **Category:** closest fit (e.g. *Data Importer*).
   - **Club:** leave blank.
   - **Website:** `https://personal-os-azure-eight.vercel.app`.
   - **Authorization Callback Domain:** `personal-os-azure-eight.vercel.app` — **bare domain only, NO `https://`, NO path**.
   - **Application Icon:** upload any small image (form requires it).
3. Copy the **Client ID** and **Client Secret** shown after saving. (The page also shows an initial access/refresh token pair we do **not** use — our OAuth flow mints its own.)
4. Set in Vercel (Production) **and** `.env.local`:
   - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
   - `STRAVA_OAUTH_REDIRECT_URI` = `https://personal-os-azure-eight.vercel.app/api/strava/callback` (use the localhost value in `.env.local`).
   - Reuse the already-set `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. **Redeploy.**
5. No rate-limit-increase request is needed (athlete capacity 1 is the default and matches the single-user model). Scopes (`activity:read_all`) are chosen by our app on the consent screen, not configured in the dashboard.

> **DECISION FOR MAX (must resolve before local testing) — single Authorization Callback Domain.** Strava allows **ONE** callback domain per app, and it must cover the redirect URI's host. The Vercel prod domain and `localhost` cannot both be covered by one app. Pick one before the build hits the live OAuth test, so it isn't discovered mid-build:
> - **(a) Recommended — two apps:** register a second "Personal OS (dev)" app with callback domain `localhost`; put its Client ID/Secret + `STRAVA_OAUTH_REDIRECT_URI=http://localhost:3000/api/strava/callback` in `.env.local`. Cleaner; prod and dev never collide.
> - **(b) One app:** flip the single callback domain between `localhost` and the Vercel domain as you switch environments. Cheaper to set up, but you must remember to flip it (and a stale domain silently fails OAuth with a redirect-uri error).
>
> The env getters throw only at call time, so the build + all non-live tasks below work without any of these set.

---

## File structure

**Create:**
- `src/lib/strava/oauth.ts` — Strava OAuth (consent / exchange / **refresh-returning-rotated-token**) + `StravaAuthError`.
- `src/lib/strava/client.ts` — authed Strava fetch helper + `StravaApiError` + **page-number** pagination.
- `src/lib/strava/workouts.ts` — `fetchActivities` + pure `mapActivity` (→ `workouts` row | null) + `STRAVA_SPORTS` lookup.
- `src/lib/strava/workouts.test.ts` — the TDD'd mapper unit tests (written FIRST).
- `src/lib/sync/strava.ts` — `syncStrava(client, userId)` (single stream, refresh-before-use, logging).
- `src/app/api/strava/connect/route.ts`
- `src/app/api/strava/callback/route.ts`
- `src/app/api/strava/sync/route.ts`
- `tests/e2e/strava.spec.ts`

**Modify:**
- `src/lib/integrations/store.ts` — widen `Provider` type to include `"strava"` (one-line union change; everything else reused).
- `src/lib/env.ts` — add `getStravaClientId/Secret/OauthRedirectUri`.
- `src/app/(app)/settings/_actions/connections.ts` — add `disconnectStrava`, `syncStravaNow`.
- `src/app/(app)/settings/ProviderConnectionRow.tsx` — add the `strava` cases to its disconnect/sync action switch + `?connected=strava` trigger (do NOT fork a new component).
- `src/app/(app)/settings/ConnectionsCard.tsx` — load `getIntegration(supabase, userId, "strava")` + render a live Strava row; drop Strava from any static placeholder list.
- `.env.example` — document `STRAVA_*`.
- `vercel.json` — add the hourly Strava cron.

**Verify-only (likely a one-line change at most):**
- `src/app/(app)/train/page.tsx` — confirm the Whoop-built workouts query reads **ALL** `workouts` rows (NOT filtered to `source='whoop'`). This is the single place a Whoop assumption could hide Strava rows. Widen if filtered (Task 10).
- `src/components/modules/train/ActivityList.tsx` — reused unchanged; Strava rows render in the same list.
- `src/lib/integrations/store.ts` crypto + `health_snapshots` — Strava NEVER writes `health_snapshots`; confirm no accidental write path (Task 5).

---

## Task 0: Strava env getters + Provider type

**Files:** Modify `src/lib/env.ts`, `src/lib/integrations/store.ts`, `.env.example`.

- [ ] **Step 1:** In `src/lib/env.ts`, add (mirroring `getWhoopClientId`/`getWhoopOauthRedirectUri`):

```ts
export function getStravaClientId(): string { return requireEnv("STRAVA_CLIENT_ID"); }
export function getStravaClientSecret(): string { return requireEnv("STRAVA_CLIENT_SECRET"); }
export function getStravaOauthRedirectUri(): string { return requireEnv("STRAVA_OAUTH_REDIRECT_URI"); }
```

- [ ] **Step 2:** In `src/lib/integrations/store.ts`, widen the provider union (the ONLY store change — every function is already provider-parameterized):

```ts
export type Provider = "google" | "whoop" | "strava";
```

- [ ] **Step 3:** Append to `.env.example`:

```
# Strava OAuth app (strava.com/settings/api)
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_OAUTH_REDIRECT_URI=http://localhost:3000/api/strava/callback
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean. **Commit** — `feat: strava env getters + provider type (1B Strava)`

## Task 1: Strava OAuth lib (rotating refresh)

**Files:** Create `src/lib/strava/oauth.ts`.
**Docs (READ FIRST — verify endpoints + the rotated refresh_token behavior + comma-delimited scopes + epoch-seconds expiry):** https://developers.strava.com/docs/authentication/

Mirror `src/lib/whoop/oauth.ts` (NOT Google — Strava rotates the refresh token like Whoop). **Strava-specific differences to confirm/implement:**
- Endpoints: auth `https://www.strava.com/oauth/authorize`, token `https://www.strava.com/oauth/token` (POST, `x-www-form-urlencoded`). **Verify at build.**
- `STRAVA_SCOPES = ["activity:read_all"]` — read-only; `read_all` (not `read`) so "Only You" / privacy-zone activities are included for a personal dashboard. **Scopes are COMMA-delimited** in the consent URL (`scope: STRAVA_SCOPES.join(",")`), not space-joined like Whoop/Google.
- `buildConsentUrl(state)` params: `client_id`, `redirect_uri`, `response_type=code`, `scope` (comma-joined), `approval_prompt=force` (force re-consent on reconnect so a rotated grant is reissued), `state`.
- `exchangeCode(code)` → `{ accessToken, refreshToken, expiresAt, athleteId }`:
  - POST `grant_type=authorization_code`, `code`, `client_id`, `client_secret`. (Strava does NOT require `redirect_uri` on token exchange, but confirm at build.)
  - Strava returns `expires_at` as **epoch SECONDS** — convert to **epoch ms** (`data.expires_at * 1000`) to match the store's convention. (Strava also returns `expires_in`; using `expires_at*1000` is the absolute instant and matches what the store stores.)
  - Throw `StravaAuthError` if no `refresh_token`.
  - The token-exchange response includes a nested `athlete` object — return `athleteId = data.athlete?.id` so the callback can stash it in metadata.
- `refreshTokens(refreshToken)` → **`{ accessToken, refreshToken, expiresAt }`** — POST `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`. **Strava ROTATES the refresh token, so RETURN the new `refresh_token`** (exactly like Whoop; unlike Google's `refreshAccessToken`). Throw `StravaAuthError` if no rotated `refresh_token` (the just-used one is now dead — persisting nothing would brick the connection). Convert `expires_at` (sec) → ms.
- `StravaAuthError extends Error` with `status`, `body` (mirror `WhoopAuthError`).

- [ ] **Step 1:** Implement per above (no unit test — thin HTTP wrapper, covered by manual OAuth at acceptance).
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: strava oauth lib (rotating refresh) (1B Strava)`

## Task 2: Strava client (page-number pagination)

**Files:** Create `src/lib/strava/client.ts`.
**Docs (READ FIRST):** https://developers.strava.com/docs/reference/ — `GET /athlete/activities`, the `page`/`per_page` params, and the response shape (a bare JSON **array** of SummaryActivity — NOT a `{ records, next_token }` envelope like Whoop).

Mirror the fetch + typed-error shape of `src/lib/whoop/client.ts` (`WhoopApiError` → `StravaApiError` with `status`; truncate the error body to ~200 chars). **The structural difference is pagination:** Strava is **page-number based**, not cursor.

- `STRAVA_API_BASE = "https://www.strava.com/api/v3/"`.
- `StravaApiError extends Error` with `status`.
- `stravaFetch<T>(accessToken, path, params)` → parsed JSON; `Authorization: Bearer`; throw `StravaApiError` on non-OK.
- `paginateActivities(accessToken, params, opts)` — loop incrementing `page` (1-based), `per_page=100`, accumulating results until a page returns **fewer than `per_page`** items (the last page) OR the **page cap** is hit. **Backfill cap (reviewer rec — locked):** `MAX_PAGES = 5` (5 × 100 = **500 activities** max for the ~30-day backfill). Pass the cap as a constant in this module so a pathological history can't exhaust the rate budget; incremental syncs are naturally tiny (1 page). After the cap, stop and let the next sync continue from `last_synced_at`.

- [ ] **Step 1:** Implement per above (no unit test — thin HTTP wrapper, covered at manual acceptance; the pagination cap is exercised implicitly by the backfill at acceptance).
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: strava client + page-number pagination w/ backfill cap (1B Strava)`

## Task 3: Strava workouts fetch + `mapActivity` — TDD

**Files:** Create `src/lib/strava/workouts.ts`, `src/lib/strava/workouts.test.ts`.
**Docs (READ FIRST):** https://developers.strava.com/docs/reference/ — SummaryActivity fields + the `sport_type` / `type` enums. **Verify the EXACT JSON keys** before wiring the mapper (the test pins the contract — rounding/units/drop-null-id; you wire the real field names).

`fetchActivities(accessToken, { after, before })` — paginated via `client.ts`; `after`/`before` are **epoch SECONDS** (Strava convention — distinct from the store's epoch-ms `expires_at`), `per_page=100`. Pure `mapActivity(raw)` → `workouts` row **or `null`** (drop), per the spec's §3c field-mapping contract.

**`mapActivity` contract (the tested logic — fixed; field extraction = verify-at-build):**
- `external_id` ← `String(raw.id)`; **return `null` if `id` is missing/falsy** (NULL `external_id` would duplicate on every sync — the unique index treats NULLs as distinct).
- `source` ← constant `"strava"`.
- `sport` ← normalize `raw.sport_type` (fallback `raw.type`) via `STRAVA_SPORTS` lookup → lowercase readable; **unknown → lowercased raw value**.
- `started_at` ← `raw.start_date` (ISO UTC, store as-is). The `workouts` table stores an absolute `timestamptz`, NOT a calendar `date` — so there is **no midnight-boundary date-bucketing** here (unlike Whoop health). Render in the operator tz in the UI (ActivityList already does this).
- `ended_at` ← `new Date(raw.start_date).getTime() + raw.elapsed_time*1000` → ISO (Strava has no end field; derive from start + elapsed).
- `duration_sec` ← `raw.moving_time` (fallback `raw.elapsed_time`).
- `distance_m` ← round `raw.distance` (meters) to **1 decimal** (`numeric(10,1)`).
- `avg_hr` ← `Math.round(raw.average_heartrate)`; **omit if `has_heartrate` is false or the field is absent**.
- `max_hr` ← `raw.max_heartrate`; omit if absent.
- `energy_kj` ← round `raw.kilojoules` to **1 decimal**; omit if absent. (Note: Strava `kilojoules` is **mechanical work**, not metabolic energy like Whoop's `energy_kj` — acceptable mixing for v1; do **not** fetch per-activity `calories`, which is DetailedActivity-only and a rate-limit waste.)
- `strain` ← **null** (Whoop-specific; Strava has no strain).
- `source_metadata` ← small blob `{ sport_type, type, timezone, utc_offset, total_elevation_gain, average_speed, max_speed }` (keep it small; lets future UI show elevation/pace without a migration).
- `user_id` ← injected by the sync core, NOT the mapper (mapper stays pure).

**`STRAVA_SPORTS` lookup (build from the docs' `sport_type` enum; reviewer rec — locked).** A `Record<string,string>` mapping Strava `sport_type`/`type` values → our shared normalized vocabulary (align with Whoop's sport strings so the Activity list reads consistently across providers). Seed it (verify the full enum at build):

```ts
const STRAVA_SPORTS: Record<string, string> = {
  Run: "run", TrailRun: "run", VirtualRun: "run",
  Ride: "ride", MountainBikeRide: "ride", GravelRide: "ride", VirtualRide: "ride", EBikeRide: "ride",
  Swim: "swim",
  Walk: "walk", Hike: "hike",
  WeightTraining: "strength", Workout: "workout", Crossfit: "strength",
  Yoga: "yoga", Rowing: "row", Elliptical: "cardio",
};
// unknown sport_type → raw.sport_type.toLowerCase()
```

- [ ] **Step 1: Failing tests** in `src/lib/strava/workouts.test.ts` (mirror `src/lib/whoop/workouts.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { mapActivity } from "./workouts";

describe("mapActivity", () => {
  it("maps a run (rounds HR, kJ, distance; derives ended_at; source/external_id set)", () => {
    const row = mapActivity({
      id: 12345678901,
      sport_type: "Run",
      type: "Run",
      start_date: "2026-06-05T12:00:00Z",
      elapsed_time: 2880, // 48 min wall clock
      moving_time: 2700, // 45 min active
      distance: 10123.45,
      has_heartrate: true,
      average_heartrate: 152.6,
      max_heartrate: 178,
      kilojoules: 1234.56,
    });
    expect(row).toMatchObject({
      source: "strava",
      external_id: "12345678901",
      sport: "run",
      started_at: "2026-06-05T12:00:00Z",
      ended_at: "2026-06-05T12:48:00.000Z", // start + elapsed_time
      duration_sec: 2700, // moving_time preferred
      distance_m: 10123.5, // rounded to 1 decimal
      avg_hr: 153, // Math.round
      max_hr: 178,
      energy_kj: 1234.6, // rounded to 1 decimal
    });
    expect(row!.strain).toBeNull();
  });

  it("normalizes sport_type via the lookup, falling back to lowercased raw for unknowns", () => {
    expect(mapActivity({ id: 1, sport_type: "MountainBikeRide", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("ride");
    expect(mapActivity({ id: 2, sport_type: "Kitesurf", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("kitesurf");
  });

  it("prefers sport_type but falls back to type when sport_type is absent", () => {
    expect(mapActivity({ id: 3, type: "Swim", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("swim");
  });

  it("uses elapsed_time for duration when moving_time is absent", () => {
    expect(mapActivity({ id: 4, sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 1800 })!.duration_sec).toBe(1800);
  });

  it("omits HR/energy when absent or has_heartrate is false (don't write nulls/zeros)", () => {
    const row = mapActivity({ id: 5, sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60, has_heartrate: false, average_heartrate: 140 });
    expect("avg_hr" in row!).toBe(false);
    expect("max_hr" in row!).toBe(false);
    expect("energy_kj" in row!).toBe(false);
  });

  it("drops an activity with no id (never insert a null external_id)", () => {
    expect(mapActivity({ sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/strava/workouts.test.ts` (FAIL: `mapActivity` not implemented).
- [ ] **Step 3: Implement** `mapActivity` + `STRAVA_SPORTS` + `fetchActivities` per the contract above. Round HR with `Math.round`; `distance_m`/`energy_kj` to 1 decimal; **include only present keys** (use a builder that conditionally sets `avg_hr`/`max_hr`/`energy_kj`); always set `source:'strava'`, `strain: null`. Confirm the exact Strava JSON keys against the live docs and fix any extraction mismatch.
- [ ] **Step 4: Run → pass** — `npx vitest run src/lib/strava/workouts.test.ts`; `npx tsc --noEmit`. **Commit** — `feat: strava workouts fetch + mapActivity (TDD) (1B Strava)`

## Task 4: Strava sync core (single stream, refresh-before-use)

**Files:** Create `src/lib/sync/strava.ts`.
Mirror `src/lib/sync/whoop.ts` but with **only Stream B (workouts)** — no `health_snapshots` write, no two-stream isolation. Reference `src/lib/sync/calendar.ts` for the refresh-retry + logging scaffolding. **Key behaviors:**

- `SYNC_PROVIDER = "strava"` (recorded on `sync_runs.provider` + `error_events.provider`).
- `syncStrava(client, userId)` (use the PASSED client — never create one):
  - `getIntegration(client, userId, "strava")`; if none → return `{ ok:false, status:"error", synced:0 }`.
  - `readTokens`; if no access token → `markStatusFor(.., "expired", "Missing access token")` + failed `sync_runs` + return.
- **Refresh handling (the real risk — Strava rotates single-use refresh tokens):**
  - `metadata.expires_at` is **epoch MILLISECONDS** (the oauth lib already converted Strava's epoch-seconds → ms). Compare against `Date.now()`.
  - **Guard the refresh token first:** if `!refreshToken` → `markStatusFor(.., "expired", "Missing refresh token")` + failed `sync_runs` + return.
  - If `expires_at` is past or within 60s of `Date.now()`: call `refreshTokens(refreshToken)` then `persistRefreshedTokens(client, userId, "strava", refreshed)` **BEFORE using the new access token** (write-before-use — Strava invalidates the old refresh token the moment it's used, so a failed persist must not leave us using an unpersisted token, which would permanently brick the connection).
  - Also catch a **401 mid-fetch** and refresh-retry once (same refresh-token guard).
  - On any refresh failure → `markStatusFor(.., "expired", msg)` + failed `sync_runs` + return (do NOT throw; auth failure raises the reconnect banner, a data hiccup does not).
- **Window (epoch SECONDS for `after`/`before`):** `last_synced_at` ? incremental `[now-2d, now]` : backfill `[now-30d, now]`. Convert the JS ms timestamps to seconds (`Math.floor(ms/1000)`) for `after`/`before` — these are NOT the same unit as `metadata.expires_at` (ms).
- **Single stream (workouts):** `fetchActivities(accessToken, { after, before })` → `mapActivity` (filter out nulls) → add `user_id` → `client.from("workouts").upsert(rows, { onConflict: "user_id,source,external_id" })`. Plain upsert is correct: each row is single-source-owned (`source='strava'`), no cross-source column to clobber. **Strava NEVER touches `health_snapshots`** — there is no second stream and no partial-merge logic here.
- **Failure handling:** an auth/refresh failure → `expired` + `failed` sync_run (above). A **data/fetch hiccup** (non-401 `StravaApiError`, a parse error, etc.) → keep `integrations.status='connected'`, record `error_events { user_id, provider:"strava", severity:"error", message, context:{ stage: "syncStravaActivities" } }`, write a `partial`/`failed` `sync_runs` row, and return `{ ok:false, status:"error", synced:0 }` — a data hiccup must NOT flip to `expired` or raise the reconnect banner.
- **Finish (success):** `touchLastSyncedFor(client, userId, "strava")`; write `sync_runs { user_id, provider:"strava", started_at, finished_at, rows_synced, status:"ok" }`. Return `{ ok:true, status:"ok", synced: rows.length }`. (`sync_runs.status ∈ {ok,partial,failed}`, `error_events.severity ∈ {info,warn,error}` — confirm against `supabase/migrations/20260527120012_create_observability.sql`.)

- [ ] **Step 1:** Implement per above.
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: strava sync core (single stream, refresh-before-use) (1B Strava)`

## Task 5: `/api/strava/connect` route

**Files:** Create `src/app/api/strava/connect/route.ts`.
**Mirror `src/app/api/whoop/connect/route.ts` exactly, changing:** import `buildConsentUrl` from `@/lib/strava/oauth`; cookie name **`strava_oauth_state`** (distinct so it can't collide with `google_oauth_state` / `whoop_oauth_state`). Keep the `getCurrentUserId` guard → `/login` redirect for signed-out, `randomBytes(16).toString("hex")` state, `httpOnly`, `secure: process.env.NODE_ENV === "production"`, `sameSite:"lax"`, `maxAge:600`, `path:"/"`.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build` compiles the route. **Commit** — `feat: strava connect route (1B Strava)`

## Task 6: `/api/strava/callback` route + inline backfill

**Files:** Create `src/app/api/strava/callback/route.ts`. `export const maxDuration = 60;`
**Mirror `src/app/api/whoop/callback/route.ts`, changing:** cookie `strava_oauth_state`; `exchangeCode` from `@/lib/strava/oauth`; `saveTokens(supabase, userId, "strava", tokens, { athlete_id: tokens.athleteId })` (stash the Strava athlete id from the token-exchange `athlete` object into metadata); `markStatusFor(supabase, userId, "strava", "error", ...)`; run `syncStrava(supabase, userId)` inline (the ~30-day backfill); redirect `/settings?connected=strava` / `?error=strava` / `?error=strava_state`. Consume the one-time state cookie on every exit path (same `finish()` helper pattern as Whoop).

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build`. **Commit** — `feat: strava callback + inline backfill (1B Strava)`

## Task 7: `/api/strava/sync` cron route + `vercel.json`

**Files:** Create `src/app/api/strava/sync/route.ts` (`export const maxDuration = 60;`); Modify `vercel.json`.
**Mirror `src/app/api/whoop/sync/route.ts` (or `src/app/api/google-calendar/sync/route.ts`), changing:** **reuse its `authMatches` constant-time `CRON_SECRET` check (copy it verbatim — do NOT regress to `===`)**; select `integrations` where `provider="strava" AND status="connected"`; call `syncStrava(admin, row.user_id)` per user; count `ok` vs `failed`; return `Response.json({ ok:true, synced, failed })`.

- [ ] **Step 1:** Implement the route (service-role admin client; every read/write explicitly scoped by `user_id` — the admin client bypasses RLS).
- [ ] **Step 2:** In `vercel.json`, add a third cron entry (hourly `0 * * * *`):

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [
  { "path": "/api/google-calendar/sync", "schedule": "*/5 * * * *" },
  { "path": "/api/whoop/sync", "schedule": "0 * * * *" },
  { "path": "/api/strava/sync", "schedule": "0 * * * *" }
] }
```

> **Note:** if Whoop's cron entry isn't yet present (Whoop must be merged per the assumption), keep its line; only ADD the Strava line. Vercel Pro allows up to 40 crons, so three hourly/5-min entries are fine.

- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm build` (route table shows `/api/strava/sync`). **Commit** — `feat: strava cron sync + vercel.json hourly (1B Strava)`

## Task 8: Live Strava connection row + actions

**Files:** Modify `src/app/(app)/settings/_actions/connections.ts`, `src/app/(app)/settings/ProviderConnectionRow.tsx`, `src/app/(app)/settings/ConnectionsCard.tsx`.

- [ ] **Step 1:** Add to `_actions/connections.ts` (mirror `disconnectWhoop`/`syncWhoopNow`):
  - `disconnectStrava()` — delete integration where `provider='strava'`, revalidate `/settings` + `/dashboard`.
  - `syncStravaNow()` — `syncStrava(supabase, userId)`, revalidate `/dashboard` + `/train` + `/settings`.
- [ ] **Step 2:** In `ProviderConnectionRow.tsx`, **add the `strava` cases** to the existing disconnect/sync action switch (import `disconnectStrava`/`syncStravaNow`; switch on `provider`), and ensure the `?connected=<provider>` post-connect trigger matches the row's own `provider`. **Do NOT fork a new component** — `ProviderConnectionRow` is already generalized (Google + Whoop); Strava is a third case. Leave `GoogleConnectionRow.tsx` untouched (the Whoop plan established this as the regression-safe choice).
- [ ] **Step 3:** In `ConnectionsCard.tsx`, also `getIntegration(supabase, userId, "strava")` and render a Strava row via `ProviderConnectionRow` (`provider="strava"`, `label="Strava"`, `sub="FITNESS"`, `connectPath="/api/strava/connect"`, `status`, `syncedLabel` via `staleAgeLabel`, `lastError`). **Remove "Strava" from any static placeholder list** if present (it currently is not in `PENDING_PROVIDERS`, but verify — leave Plaid / Health Auto Export as static `NOT CONNECTED`).
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: live strava connection row + actions (1B Strava)`

## Task 9: Train Activity section — verify provider-agnostic (CRITICAL regression check)

**Files:** Read (and at most one-line modify) `src/app/(app)/train/page.tsx`; Read `src/components/modules/train/ActivityList.tsx`.

> **This is the one place a Whoop assumption could silently hide Strava rows.** Whoop built the Train "Activity" section + the query reading `workouts`. Strava writes into the SAME table, so its rows should appear automatically — UNLESS the Whoop-built query filtered to `source='whoop'`.

- [ ] **Step 1:** Open `src/app/(app)/train/page.tsx` and inspect the workouts query. **Confirm it selects ALL `workouts` rows ordered by `started_at desc` (NOT `.eq("source","whoop")`).**
  - If it already reads all `workouts` → **no change** (Strava rows render automatically).
  - If it filters by `source='whoop'` → **widen it (remove the `.eq("source", ...)` filter)** so both providers' workouts show in one list. One-line change.
- [ ] **Step 2:** Confirm `ActivityList.tsx` renders generically off the row columns (`sport`, `started_at`, `duration_sec`, `avg_hr`, optionally `strain`/`distance_m`) — it does NOT branch on `source`. Strava rows have `strain=null` (renders blank) and now a populated `distance_m`. No change required for acceptance.
- [ ] **Step 3 (OPTIONAL — flag, not required for acceptance):** since `distance_m` is now populated for runs/rides, `ActivityList` could show distance (km/mi) for distance sports. Note as a small optional follow-up; do NOT block on it.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** (only if a change was made) — `fix: train activity query reads all workouts (provider-agnostic) (1B Strava)`. Otherwise note "verified provider-agnostic, no change."

## Task 10: Playwright + full verification gate (incl. Whoop/Google regression)

**Files:** Create `tests/e2e/strava.spec.ts`.
**Reminder (project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

- [ ] **Step 1:** Create `tests/e2e/strava.spec.ts` (UNAUTHENTICATED, mirror `tests/e2e/whoop.spec.ts`): assert signed-out `/api/strava/connect` redirects to `/login`. Do NOT build an auth fixture or hit Strava.
- [ ] **Step 2: Run the full gate:**
  - `pnpm test` → all unit pass (crypto, store, google calendar, stale, whoop health, whoop workouts, **strava workouts `mapActivity`**).
  - `npx tsc --noEmit` → 0 errors.
  - `pnpm lint` → 0 errors.
  - `pnpm build` → succeeds; route table shows `/api/strava/connect`, `/api/strava/callback`, `/api/strava/sync`.
  - `pnpm test:e2e` → green.
- [ ] **Step 3: Whoop/Google regression check (CODE-level, automatable now):**
  - The store change is a **type-union widening only** (`Provider` += `"strava"`); all existing `getGoogleIntegration`/`saveGoogleTokens`/`markStatus`/`touchLastSynced` and the Whoop call sites compile unchanged. Confirm the Google + Whoop unit tests (`store.test.ts` incl. `buildSaveUpsert`/`buildRefreshUpdate`, `whoop/health.test.ts`, `whoop/workouts.test.ts`) all pass unchanged.
  - `GoogleConnectionRow.tsx` must be byte-for-byte unchanged. `ProviderConnectionRow.tsx` gained a `strava` case but the `google`/`whoop` cases are untouched.
  - **CRITICAL — Train query:** re-confirm (Task 9) the Train workouts query reads ALL `workouts` (not `source='whoop'`-filtered) so Whoop AND Strava rows coexist in the Activity list. This is the one Whoop assumption that could hide Strava rows.
  - **No-clobber:** confirm `src/lib/sync/strava.ts` has NO `health_snapshots` write path (single stream only) — a Strava sync must not touch the shared daily health row.
  - The *runtime* refresh-path checks (Google ~1h, Whoop 6h, Strava 6h token expiry) are part of **manual acceptance** below.
- [ ] **Step 4: Commit** — `test: e2e strava + green full gate (1B Strava)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After Max's pre-flight (Client ID/Secret + redirect URI set in Vercel + `.env.local`, callback-domain decision resolved) + deploy:
1. Sign in → **Settings → Connections → Connect** on Strava → Strava consent (`activity:read_all`) → approve.
2. Redirected to Settings showing **Strava · CONNECTED**, auto-syncing; the ~30-day backfill lands recent activities into `workouts` (`source='strava'`).
3. **Train page Activity section** shows real Strava activities (runs/rides/swims — type, time, duration, distance, HR) **alongside any Whoop workouts** (web + mobile).
4. **Hourly cron:** log a new activity in Strava, wait ≤1h (or trigger the cron) → the new activity appears.
5. **Refresh-path check (the real risk):** wait past the **6-hour** Strava access-token expiry (or force it), then run a sync → confirm it still lands. This exercises the **rotated-refresh-token persist-before-use** path (a botched rotation would permanently brick the connection).
6. **No-clobber check:** confirm a Strava sync does NOT touch `health_snapshots`, and that Whoop + Strava workouts coexist in the Activity list with no collisions (distinct `(source, external_id)` rows).
7. **Disconnect** → confirm → row returns to NOT CONNECTED; **reconnect** works (`approval_prompt=force` reissues the grant).
8. **Whoop + Google regression (runtime):** confirm Whoop Health/Activity still render AND still refresh (wait past Whoop's 6h token expiry), and Google Calendar still renders + refreshes (~1h). Both share the generalized store/refresh path Strava reused.

Passing = the Strava slice is done. **Next roadmap:** Apple Health → Plaid. Gmail parked.

## Notes / deviations

- **Near-pure consumer:** Strava adds a provider with effectively zero new foundation — the only store edit is a one-line `Provider` union widening; the token store, crypto, `ProviderConnectionRow`, `ActivityList`, and the `workouts` table are all reused. This slice proves the multi-provider abstraction the Whoop slice introduced.
- **Single stream (vs Whoop's two):** Strava has no recovery/sleep/HRV equivalent, so there is **no `health_snapshots` write** and **no partial-merge logic** — the sync collapses to one workouts stream with a plain upsert. This is the biggest simplification over Whoop.
- **Zero migration:** the `workouts` table already whitelists `'strava'` and has `distance_m`. No DB change, no `database.types.ts` regen.
- **Two epoch units (a real footgun):** the store's `metadata.expires_at` is epoch **milliseconds**; Strava's API `expires_at` (token) and `after`/`before` (activity window) are epoch **seconds**. The oauth lib normalizes token expiry to ms on the way in; the sync core converts the window to seconds on the way out. Keep these straight.
- **`kilojoules` → `energy_kj`:** Strava kJ is mechanical work, not metabolic energy like Whoop's `energy_kj` — acceptable mixing for v1; revisit if a future health view needs true calories.
- **Backfill cap locked:** `MAX_PAGES = 5` × `per_page=100` = 500 activities max for the ~30-day backfill, so a pathological history can't exhaust the rate budget; incremental syncs are 1 page.
- **Optional, deferred (flagged, not in acceptance):** distance rendering in `ActivityList` (km/mi for distance sports); `POST /oauth/revoke` on disconnect to invalidate the grant server-side (vs just deleting the local row).
- **Strava API:** all endpoints/scopes/response fields are **verify-at-build against developers.strava.com** — the `mapActivity` tested logic (rounding, unit/epoch conversions, drop-null-id, started_at/ended_at derivation, sport normalization) is fixed; the field extraction is not.
