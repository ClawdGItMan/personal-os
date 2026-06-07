# Personal OS 1B.2 — Whoop (Health Metrics + Workouts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **You are a fresh session with no prior context. Read this whole plan + the spec before starting.** The 1B.1a Google integration is **live in production** and is your working template — mirror its files, don't reinvent. Do NOT break it (there's a regression gate at the end).
>
> **Before writing ANY Whoop API / OAuth code, open the CURRENT docs at https://developer.whoop.com and verify endpoints, API version (v2 is current; v1 is sunset), scope strings, and JSON response field names.** Your training data for the Whoop API is unreliable — the mappers below specify the *contract and rounding/date logic* (which is tested); you must confirm the actual field names and fix the extraction.

**Goal:** Max connects Whoop once from Settings; the dashboard Health view shows his real daily Recovery/Sleep/Strain/HRV/RHR and the Train page shows his Whoop workouts, kept fresh by an hourly Vercel Cron.

**Architecture:** Reuse the 1B.1a connection foundation, generalized to be provider-aware (the `integrations` token store gets a `provider` param + Google-compatible wrappers + rotating-refresh-token handling). A Whoop OAuth lib + a two-stream sync core write daily metrics into the existing `health_snapshots` (partial column-merge) and workouts into a new provider-agnostic `workouts` table (plain upsert). Connect/callback/cron routes + a generalized Connections row + a Train "Activity" section mirror the Google slice.

**Tech Stack:** Next.js 16 (App Router route handlers), React 19 server components, Supabase (`@supabase/ssr` cookie client + `@supabase/supabase-js` service-role admin client), Node `crypto` (reuse AES-256-GCM token encryption), Zod, Vitest, Playwright, Vercel Cron (Pro).

**Spec:** `docs/superpowers/specs/2026-06-05-personal-os-whoop-health-design.md` (read it — it has the merge-policy, token-rotation, and regression rationale).

**Foundation templates (read these first — you will mirror them):**
- `src/lib/integrations/store.ts` — token store (you GENERALIZE this in Task 2)
- `src/lib/google/oauth.ts` — OAuth lib pattern (Task 3 mirrors it)
- `src/lib/google/calendar.ts` — fetch + mapper + typed error pattern (Tasks 4–5)
- `src/lib/sync/calendar.ts` — sync core: refresh-retry, upsert, sync_runs/error_events logging (Task 6)
- `src/app/api/google/connect/route.ts`, `.../google/callback/route.ts`, `.../google-calendar/sync/route.ts` (Tasks 7–9)
- `src/app/(app)/settings/GoogleConnectionRow.tsx`, `ConnectionsCard.tsx`, `_actions/connections.ts` (Task 10)
- `src/lib/crypto/tokens.ts` (reused as-is), `src/lib/env.ts` (Task 1), `src/lib/supabase/admin.ts` (reused)

---

## Pre-flight — Max's one-time Whoop setup (BLOCKS Tasks 7–9 live test; everything else can be built without it)

Provide Max this click-by-click; confirm the env vars exist in Vercel before the live acceptance.

1. Go to **developer.whoop.com** → sign in with his Whoop account → create a new **app**.
2. Set the **redirect URI** to `https://personal-os-azure-eight.vercel.app/api/whoop/callback` (and `http://localhost:3000/api/whoop/callback` for local).
3. Enable scopes: `read:recovery read:sleep read:cycles read:workout read:profile offline`.
4. Copy the **Client ID** and **Client Secret**.
5. Set in Vercel (Production) **and** `.env.local`: `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_OAUTH_REDIRECT_URI` (`=https://personal-os-azure-eight.vercel.app/api/whoop/callback`). Reuse the existing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (already set). Redeploy.

The env getters throw only at call time, so the build/tasks below work without these set.

---

## File structure

**Create:**
- `supabase/migrations/20260605120000_create_workouts.sql` — provider-agnostic workouts table
- `src/lib/whoop/oauth.ts` — Whoop OAuth (consent/exchange/refresh-returning-rotated-token)
- `src/lib/whoop/client.ts` — authed Whoop fetch helper + `WhoopApiError` + pagination
- `src/lib/whoop/health.ts` — fetch recovery/sleep/cycle + `mapHealthDay` (→ health_snapshots partial)
- `src/lib/whoop/health.test.ts`
- `src/lib/whoop/workouts.ts` — fetch workouts + `mapWorkout` (→ workouts row) + sport lookup
- `src/lib/whoop/workouts.test.ts`
- `src/lib/sync/whoop.ts` — `syncWhoop(client, userId)` (two streams, partial isolation, logging)
- `src/app/api/whoop/connect/route.ts`
- `src/app/api/whoop/callback/route.ts`
- `src/app/api/whoop/sync/route.ts`
- `src/app/(app)/settings/ProviderConnectionRow.tsx` — generalized connection row (Google + Whoop)
- `src/components/modules/train/ActivityList.tsx` — renders workout rows
- `tests/e2e/whoop.spec.ts`

**Modify:**
- `src/lib/integrations/store.ts` — provider-param core + Google wrappers + `persistRefreshedTokens`
- `src/lib/sync/calendar.ts` — route its `persistAccessToken` through `persistRefreshedTokens` (metadata-merge fix)
- `src/lib/env.ts` — add `getWhoopClientId/Secret/RedirectUri`
- `src/lib/supabase/database.types.ts` — regenerate after the migration (adds `workouts`)
- `src/app/(app)/settings/_actions/connections.ts` — add `disconnectWhoop`, `syncWhoopNow`
- `src/app/(app)/settings/ConnectionsCard.tsx` — render a live Whoop row via `ProviderConnectionRow`
- `src/app/(app)/train/page.tsx` — add an Activity section reading `workouts`
- `.env.example` — document `WHOOP_*`
- `vercel.json` — add the hourly Whoop cron

**Verify-only (likely no change):**
- `src/app/(app)/health/page.tsx` — already renders recovery/sleep/strain/HRV/weight/steps from the latest `health_snapshots` row.

---

## Task 0: Workouts table migration + regenerate types

**Files:** Create `supabase/migrations/20260605120000_create_workouts.sql`; Modify `src/lib/supabase/database.types.ts`.

- [ ] **Step 1: Write the migration** (mirrors the RLS pattern in `20260527120009_create_training.sql`):

```sql
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','whoop','strava','apple_health')),
  external_id text,                 -- provider workout id; null for manual rows (NULLs are distinct in the unique index)
  sport text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec integer,
  strain numeric(4,1),              -- Whoop-specific; nullable
  avg_hr integer,
  max_hr integer,
  energy_kj numeric(8,1),           -- Whoop reports kilojoules; nullable
  distance_m numeric(10,1),         -- Strava/runs later; nullable
  source_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.workouts enable row level security;
create policy "workouts_select_own" on public.workouts for select using (auth.uid() = user_id);
create policy "workouts_insert_own" on public.workouts for insert with check (auth.uid() = user_id);
create policy "workouts_update_own" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workouts_delete_own" on public.workouts for delete using (auth.uid() = user_id);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
```

- [ ] **Step 2: Apply the migration to the Supabase project.** The table is additive (no changes to existing tables), so it's safe. Use the Supabase MCP `apply_migration` tool (project ref `evpuwdkrypzugdgxtqak`), or `npx supabase db push` if the CLI is linked. **Confirm with the operator before applying to the live DB.**
- [ ] **Step 3: Regenerate types** so `Database["public"]["Tables"]["workouts"]` exists. **Preferred:** the Supabase MCP `generate_typescript_types` tool (project ref `evpuwdkrypzugdgxtqak`) — the local `supabase` CLI may not be linked, so don't assume `supabase gen types` works without checking. Overwrite `src/lib/supabase/database.types.ts`. **HARD GATE:** run `grep -c "workouts" src/lib/supabase/database.types.ts` — if it returns `0`, the regen failed; **STOP and do not start any task that queries `workouts` (Tasks 6, 11)** until it returns > 0, or those tasks will fail `tsc`.
- [ ] **Step 4: Verify** `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat: add provider-agnostic workouts table (1B.2)`

## Task 1: Whoop env getters

**Files:** Modify `src/lib/env.ts`, `.env.example`.

- [ ] **Step 1:** In `src/lib/env.ts`, add (mirroring `getGoogleClientId`):

```ts
export function getWhoopClientId(): string { return requireEnv("WHOOP_CLIENT_ID"); }
export function getWhoopClientSecret(): string { return requireEnv("WHOOP_CLIENT_SECRET"); }
export function getWhoopOauthRedirectUri(): string { return requireEnv("WHOOP_OAUTH_REDIRECT_URI"); }
```

- [ ] **Step 2:** Append to `.env.example`:

```
# Whoop OAuth app (developer.whoop.com)
WHOOP_CLIENT_ID=your-whoop-client-id
WHOOP_CLIENT_SECRET=your-whoop-client-secret
WHOOP_OAUTH_REDIRECT_URI=http://localhost:3000/api/whoop/callback
```

- [ ] **Step 3: Verify** `npx tsc --noEmit`. **Commit** — `feat: whoop env getters (1B.2)`

## Task 2: Generalize the token store (provider-aware + rotating refresh + metadata merge)

**Files:** Modify `src/lib/integrations/store.ts`, `src/lib/integrations/store.test.ts`, `src/lib/sync/calendar.ts`.

**Why:** Whoop rotates (single-use) refresh tokens and stores extra `metadata`. The store must (a) be provider-parameterized, (b) persist a *new* refresh token on refresh, (c) **merge** metadata rather than replace it. The existing Google functions become thin wrappers so **all Google call sites and the existing `store.test.ts` stay unchanged**.

- [ ] **Step 1: Add the rotating-refresh test** to `src/lib/integrations/store.test.ts` (keep the existing `readTokens` test as-is):

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
// existing imports stay

beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("base64"); });

// Unit-test the pure helpers that build the persist/save payloads. Implement
// `buildRefreshUpdate` and `buildSaveUpsert` in store.ts and export them.
import { buildRefreshUpdate, buildSaveUpsert } from "./store";
import { decryptToken } from "@/lib/crypto/tokens";

describe("buildRefreshUpdate", () => {
  it("encrypts the new access token and merges metadata, NOT replacing it", () => {
    const upd = buildRefreshUpdate({ whoop_user_id: 42, expires_at: 1 }, { accessToken: "at2", expiresAt: 999 });
    expect(decryptToken(upd.access_token as string)).toBe("at2");
    expect(upd.metadata).toEqual({ whoop_user_id: 42, expires_at: 999 });
    expect("refresh_token" in upd).toBe(false); // omitted when not rotated (Google)
  });
  it("includes the rotated refresh token when provided (Whoop)", () => {
    const upd = buildRefreshUpdate({}, { accessToken: "at2", refreshToken: "rt2", expiresAt: 999 });
    expect(decryptToken(upd.refresh_token as string)).toBe("rt2");
  });
});

describe("buildSaveUpsert", () => {
  it("sets status connected, last_error null, both encrypted tokens, and metadata", () => {
    const row = buildSaveUpsert("u1", "whoop", { accessToken: "at", refreshToken: "rt", expiresAt: 5 }, { whoop_user_id: 7 });
    expect(row).toMatchObject({ user_id: "u1", provider: "whoop", status: "connected", last_error: null });
    expect(decryptToken(row.access_token as string)).toBe("at");
    expect(decryptToken(row.refresh_token as string)).toBe("rt");
    // authoritative expires_at wins even if extraMetadata tries to set it
    expect(row.metadata).toMatchObject({ whoop_user_id: 7, expires_at: 5 });
  });
});
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/integrations/store.test.ts` (FAIL: `buildRefreshUpdate` not exported).
- [ ] **Step 3: Rewrite `src/lib/integrations/store.ts`** to the generalized version. Keep `readTokens` and `GOOGLE_PROVIDER` exactly. Add:

```ts
export type Provider = "google" | "whoop";
export type ProviderTokens = { accessToken: string; refreshToken: string; expiresAt: number };
export type GoogleTokens = ProviderTokens; // back-compat alias (no existing call site imports this by name)

/** Pure: builds the INSERT/UPSERT payload for saving tokens. MUST keep status + last_error:null. */
export function buildSaveUpsert(
  userId: string, provider: Provider, tokens: ProviderTokens,
  extraMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    user_id: userId,
    provider,
    access_token: encryptToken(tokens.accessToken),
    refresh_token: encryptToken(tokens.refreshToken),
    status: "connected",
    last_error: null, // clears any stale error on (re)connect — preserves the live saveGoogleTokens behavior
    metadata: { ...extraMetadata, expires_at: tokens.expiresAt }, // authoritative expires_at always wins
  };
}

/** Pure: builds the UPDATE payload for a refreshed token, merging metadata. */
export function buildRefreshUpdate(
  currentMetadata: Record<string, unknown> | null | undefined,
  refreshed: { accessToken: string; refreshToken?: string; expiresAt: number },
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    access_token: encryptToken(refreshed.accessToken),
    metadata: { ...(currentMetadata ?? {}), expires_at: refreshed.expiresAt },
  };
  if (refreshed.refreshToken) update.refresh_token = encryptToken(refreshed.refreshToken);
  return update;
}
```

Then provider-parameterized core functions — `getIntegration(client, userId, provider)`; `saveTokens(client, userId, provider, tokens, extraMetadata = {})` whose body is `await client.from("integrations").upsert(buildSaveUpsert(userId, provider, tokens, extraMetadata), { onConflict: "user_id,provider" })` (so `status:'connected'` + `last_error:null` + both tokens + metadata are all set — **do not hand-roll a payload that drops `last_error`**); `markStatusFor(client, userId, provider, status, lastError?)`; `touchLastSyncedFor(client, userId, provider)`; and:

```ts
/** Persist refreshed tokens in place; reads current row to MERGE metadata.
 *  Pass refreshToken ONLY for providers that rotate it (Whoop); omit for Google. */
export async function persistRefreshedTokens(
  client: Client, userId: string, provider: Provider,
  refreshed: { accessToken: string; refreshToken?: string; expiresAt: number },
): Promise<void> {
  const current = await getIntegration(client, userId, provider);
  const update = buildRefreshUpdate(current?.metadata as Record<string, unknown> | undefined, refreshed);
  const { error } = await client.from("integrations").update(update).eq("user_id", userId).eq("provider", provider);
  if (error) throw new Error(error.message);
}
```

Finally, **backwards-compatible Google wrappers** (identical signatures to today, so nothing Google changes):

```ts
export async function getGoogleIntegration(client: Client, userId: string) { return getIntegration(client, userId, "google"); }
export async function saveGoogleTokens(client: Client, userId: string, tokens: ProviderTokens) { return saveTokens(client, userId, "google", tokens); }
export async function markStatus(client: Client, userId: string, status: string, lastError?: string) { return markStatusFor(client, userId, "google", status, lastError); }
export async function touchLastSynced(client: Client, userId: string) { return touchLastSyncedFor(client, userId, "google"); }
```

(`GoogleTokens` is already aliased to `ProviderTokens` at the top of the file, so `saveGoogleTokens`'s signature is byte-for-byte unchanged.)

- [ ] **Step 4:** In `src/lib/sync/calendar.ts`, replace the body of the private `persistAccessToken(...)` with a call to `persistRefreshedTokens(client, userId, "google", { accessToken, expiresAt })` (no refreshToken — Google doesn't rotate). This fixes the latent metadata clobber and keeps the call site identical.
- [ ] **Step 5: Run → pass** — `npx vitest run src/lib/integrations/store.test.ts` (existing `readTokens` test + 2 new pass). `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** — `refactor: provider-aware token store + rotating-refresh + metadata merge (1B.2)`

## Task 3: Whoop OAuth lib

**Files:** Create `src/lib/whoop/oauth.ts`.
**Docs (READ FIRST — verify endpoints + the rotated refresh_token behavior):** https://developer.whoop.com (OAuth section).

Mirror `src/lib/google/oauth.ts`. **Critical differences from Google:**
- `WHOOP_SCOPES = ["read:recovery","read:sleep","read:cycles","read:workout","read:profile","offline"]`.
- Auth + token endpoints are Whoop's (verify exact URLs at build — likely `https://api.prod.whoop.com/oauth/oauth2/auth` and `/token`).
- `buildConsentUrl(state)` — same params as Google (`response_type=code`, `scope` space-joined, `state`); Whoop requires `state` ≥ 8 chars (our 32-hex satisfies it).
- `exchangeCode(code)` → `{ accessToken, refreshToken, expiresAt }` — **throw `WhoopAuthError` if no `refresh_token`** (we requested `offline`).
- `refreshTokens(refreshToken)` → **`{ accessToken, refreshToken, expiresAt }`** — Whoop **rotates** the refresh token, so RETURN the new `refresh_token` (unlike Google's `refreshAccessToken`, which discards it). This is the single most important difference.
- `WhoopAuthError extends Error` with `status`, `body` (mirror `GoogleAuthError`).

- [ ] **Step 1:** Implement per above (no unit test — thin HTTP wrapper, covered by manual OAuth at acceptance).
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: whoop oauth lib (rotating refresh) (1B.2)`

## Task 4: Whoop client + health fetch + `mapHealthDay` — TDD

**Files:** Create `src/lib/whoop/client.ts`, `src/lib/whoop/health.ts`, `src/lib/whoop/health.test.ts`.
**Docs (READ FIRST):** https://developer.whoop.com — recovery, sleep, cycle endpoints + response shapes + pagination (`nextToken`).

`client.ts`: `whoopFetch(accessToken, path, params)` → JSON; throws `WhoopApiError` (with `status`) on non-OK; a `paginate(accessToken, path, params)` helper that follows `nextToken`. Mirror the fetch/error shape of `src/lib/google/calendar.ts` (`GoogleCalendarError` → `WhoopApiError`, truncate error body to ~200 chars).

`health.ts`: `fetchHealthWindow(accessToken, { start, end })` returns raw recovery + sleep + cycle records; and a **pure** `mapHealthDay(input)` that produces a partial `health_snapshots` row. The test pins the *contract + rounding + date* (you wire the real field names after reading the docs):

- [ ] **Step 1: Failing tests** in `src/lib/whoop/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapHealthDay } from "./health";

describe("mapHealthDay", () => {
  it("maps + rounds to column precision and tags source", () => {
    const row = mapHealthDay({
      date: "2026-06-05",
      recoveryScore: 66.7, dayStrain: 12.34,
      sleepPerformance: 88.6, sleepHours: 7.48,
      hrv: 89.3, rhr: 54.6,
    });
    expect(row).toMatchObject({
      date: "2026-06-05", source: "whoop",
      recovery_score: 67, strain: 12.3, sleep_score: 89, sleep_hours: 7.5, hrv: 89, rhr: 55,
    });
  });
  it("omits fields that are absent (so the partial upsert won't null them)", () => {
    const row = mapHealthDay({ date: "2026-06-05", recoveryScore: 50 });
    expect(row.recovery_score).toBe(50);
    expect("strain" in row).toBe(false);
    expect("sleep_hours" in row).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `mapHealthDay` (round ints with `Math.round`; `strain`/`sleep_hours` to 1 decimal; include only present keys; always set `date`, `source:'whoop'`). Implement `fetchHealthWindow` + `client.ts` per the docs. **Date assignment:** map each cycle/sleep to a calendar `date` in the user's timezone (`profiles.timezone`) — a sleep that ends after midnight belongs to the day it *ends* (the cycle's day). **Add a mandatory focused unit test** for this boundary (e.g. a sleep ending `2026-06-05T01:30:00` local lands on `date = 2026-06-05`, not the prior day) — this is the one genuinely novel piece of logic in the slice.
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: whoop health fetch + mapHealthDay (1B.2)`

## Task 5: Whoop workouts fetch + `mapWorkout` — TDD

**Files:** Create `src/lib/whoop/workouts.ts`, `src/lib/whoop/workouts.test.ts`.
**Docs (READ FIRST):** https://developer.whoop.com — workout/activity endpoint + the **sport-id → name** enum.

`fetchWorkouts(accessToken, { start, end })` (paginated via `client.ts`). Pure `mapWorkout(raw)` → workouts row **or `null`** (drop). Sport id mapped via a small lookup (`WHOOP_SPORTS: Record<number,string>`, fill from the docs; unknown → `"workout"`).

- [ ] **Step 1: Failing tests** in `src/lib/whoop/workouts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapWorkout } from "./workouts";

describe("mapWorkout", () => {
  it("maps a workout (rounds HR, kJ from joules, source/external_id set)", () => {
    const row = mapWorkout({
      id: "w-123", sportId: 1,
      start: "2026-06-05T12:00:00Z", end: "2026-06-05T12:45:00Z",
      strain: 9.86, averageHeartRate: 142.6, maxHeartRate: 171.2, kilojoules: 1234.5,
    });
    expect(row).toMatchObject({
      source: "whoop", external_id: "w-123", started_at: "2026-06-05T12:00:00Z",
      duration_sec: 2700, strain: 9.9, avg_hr: 143, max_hr: 171, energy_kj: 1234.5,
    });
    expect(typeof row!.sport).toBe("string");
  });
  it("drops a workout with no id (never insert a null external_id)", () => {
    expect(mapWorkout({ sportId: 1, start: "2026-06-05T12:00:00Z" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `mapWorkout` (return `null` when `id` is missing/falsy; `duration_sec` from start/end; round HR ints; `strain`/`energy_kj` to 1 decimal; `distance_m` null for now; `source_metadata` = `{}` or raw extras) + `fetchWorkouts`. Confirm Whoop's energy unit (kJ) and field names against the docs and adjust.
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: whoop workouts fetch + mapWorkout (1B.2)`

## Task 6: Whoop sync core (two streams, isolated failures)

**Files:** Create `src/lib/sync/whoop.ts`.
Mirror `src/lib/sync/calendar.ts` for the refresh/log/status scaffolding. **Key behaviors:**

- `syncWhoop(client, userId)`: load `getIntegration(client, userId, "whoop")`; if none → return `{ ok:false, status:"error" }`. `readTokens`; if no access token → `markStatusFor(..,"expired",..)` + failed `sync_runs` + return.
- **Refresh handling:** `metadata.expires_at` is **epoch milliseconds** (`Date.now() + expires_in*1000`) — compare against `Date.now()`, not seconds. First **guard the refresh token**: if `!refreshToken` → `markStatusFor(..,"expired","Missing refresh token")` + failed `sync_runs` + return (mirror the `&& refreshToken` guard in `src/lib/sync/calendar.ts`). Otherwise, if `expires_at` is past or within 60s of `Date.now()`, call `refreshTokens(refreshToken)` then `persistRefreshedTokens(client, userId, "whoop", refreshed)` **BEFORE using the new access token** (write-before-use — a single-use Whoop refresh token is invalidated server-side the moment it's used, so a failed write must not leave us using an unpersisted token). Also catch a 401 mid-fetch and refresh-retry once (same refresh-token guard). On any refresh failure → `markStatusFor(..,"expired",msg)` + failed `sync_runs` + return. **Do not run the cron and an inline backfill concurrently for the same user** (the callback's inline backfill completes before the next cron tick).
- **Window:** `last_synced_at` ? incremental `[now-2d, now]` : backfill `[now-30d, now]`.
- **Stream A (health):** `fetchHealthWindow` → group/`mapHealthDay` per date → for each, **partial merge-upsert**:

```ts
await client.from("health_snapshots").upsert(partialRow, { onConflict: "user_id,date" });
// partialRow contains ONLY user_id, date, source:'whoop', and the present whoop metric columns.
// Postgres ON CONFLICT DO UPDATE only sets supplied columns → weight/steps/vo2_max preserved.
```

- **Stream B (workouts):** `fetchWorkouts` → `mapWorkout` (drop nulls) → add `user_id` → `client.from("workouts").upsert(rows, { onConflict: "user_id,source,external_id" })`.
- **Failure isolation:** wrap each stream in its own try/catch. A stream error records `error_events` `{ user_id, provider:"whoop", severity:"error", message, context:{ stage: "syncWhoopHealth" | "syncWhoopWorkouts" } }`, sets a `partial` flag, and **keeps `integrations.status='connected'`** (a data hiccup must NOT flip to `expired` or raise the reconnect banner — only auth/refresh failure does).
- Finish: `touchLastSyncedFor(client, userId, "whoop")`; write `sync_runs` `{ user_id, provider:"whoop", started_at, finished_at, rows_synced: healthRows+workoutRows, status: anyStreamFailed ? "partial" : "ok", error_message }`. (`sync_runs.status ∈ {ok,partial,failed}`, `error_events.severity ∈ {info,warn,error}` — confirm against `supabase/migrations/20260527120012_create_observability.sql`.) Return `{ ok, status, healthRows, workoutRows }`.

- [ ] **Step 1:** Implement per above (use the PASSED client; never create one).
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: whoop sync core (health + workouts, isolated streams) (1B.2)`

## Task 7: `/api/whoop/connect` route

**Files:** Create `src/app/api/whoop/connect/route.ts`.
**Mirror `src/app/api/google/connect/route.ts` exactly, changing:** import `buildConsentUrl` from `@/lib/whoop/oauth`; cookie name **`whoop_oauth_state`** (NOT `google_oauth_state`). Keep the `getCurrentUserId` guard, `randomBytes(16).toString("hex")` state, `secure: process.env.NODE_ENV === "production"`.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build` compiles the route. **Commit** — `feat: whoop connect route (1B.2)`

## Task 8: `/api/whoop/callback` route + inline backfill

**Files:** Create `src/app/api/whoop/callback/route.ts`. `export const maxDuration = 60;`
**Mirror `src/app/api/google/callback/route.ts`, changing:** cookie `whoop_oauth_state`; `exchangeCode` from `@/lib/whoop/oauth`; `saveTokens(supabase, userId, "whoop", tokens, { /* optional whoop user id from profile fetch */ })`; `markStatusFor(supabase, userId, "whoop", "error", ...)`; run `syncWhoop(supabase, userId)` inline; redirect `/settings?connected=whoop` / `/settings?error=whoop` / `/settings?error=whoop_state`.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build`. **Commit** — `feat: whoop callback + inline backfill (1B.2)`

## Task 9: `/api/whoop/sync` cron route + `vercel.json`

**Files:** Create `src/app/api/whoop/sync/route.ts` (`export const maxDuration = 60;`); Modify `vercel.json`.
**Mirror `src/app/api/google-calendar/sync/route.ts`, changing:** reuse its `authMatches` constant-time `CRON_SECRET` check (copy it); select `integrations` where `provider="whoop" AND status="connected"`; call `syncWhoop(admin, row.user_id)`; count `ok` vs `failed`.

- [ ] **Step 1:** Implement route.
- [ ] **Step 2:** In `vercel.json`, add a second cron entry (hourly):

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [
  { "path": "/api/google-calendar/sync", "schedule": "*/5 * * * *" },
  { "path": "/api/whoop/sync", "schedule": "0 * * * *" }
] }
```

- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm build`. **Commit** — `feat: whoop cron sync + vercel.json hourly (1B.2)`

## Task 10: Generalized Connections row + Whoop actions

**Files:** Create `src/app/(app)/settings/ProviderConnectionRow.tsx`; Modify `src/app/(app)/settings/_actions/connections.ts`, `src/app/(app)/settings/ConnectionsCard.tsx`.

- [ ] **Step 1:** Add to `_actions/connections.ts` (mirror `disconnectGoogle`/`syncGoogleNow`): `disconnectWhoop()` (delete integration where provider `whoop`, revalidate `/settings` + `/dashboard`) and `syncWhoopNow()` (`syncWhoop(supabase, userId)`, revalidate `/dashboard` + `/train` + `/settings`).
- [ ] **Step 2:** Create `ProviderConnectionRow.tsx` by copying `GoogleConnectionRow.tsx` and parameterizing it — props `{ provider, label, sub, connectPath, status, syncedLabel, lastError }`, picking the disconnect/sync action by `provider` (import all four actions, switch on `provider`), and matching the `?connected=<provider>` post-connect trigger to its own `provider`. **Do NOT modify or delete `GoogleConnectionRow.tsx`** — leave the live Google row byte-for-byte unchanged and wire `ProviderConnectionRow` for Whoop only (a later cleanup can converge the two). This is the regression-safe choice for a one-shot session.
- [ ] **Step 3:** In `ConnectionsCard.tsx`, also load `getIntegration(supabase, userId, "whoop")` and render a Whoop row via `ProviderConnectionRow` (`provider="whoop"`, `label="Whoop"`, `sub="HEALTH"`, `connectPath="/api/whoop/connect"`, `syncedLabel` via `staleAgeLabel`). Keep Plaid/Health Auto Export as static `NOT CONNECTED`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: live whoop connection row + actions (1B.2)`

## Task 11: Train Activity section

**Files:** Create `src/components/modules/train/ActivityList.tsx`; Modify `src/app/(app)/train/page.tsx`.

- [ ] **Step 1:** Read `src/app/(app)/train/page.tsx` to learn its layout/primitives (Card, etc.).
- [ ] **Step 2:** Create `ActivityList.tsx` — a presentational list taking `{ workouts, timeZone }` props. Each row: `sport` (uppercased), date/time formatted via `Intl.DateTimeFormat` in `timeZone` (mirror `CalendarList.tsx`'s `formatWhen` **including its invalid-tz → UTC try/catch fallback**), `duration` (minutes from `duration_sec`), `strain`, `avg_hr`. Mirror `src/components/modules/calendar/CalendarList.tsx` styling.
- [ ] **Step 3:** In `train/page.tsx`, get the timezone exactly as `CalendarCard.tsx` does — `import { getOperator } from "@/lib/operator"`, then `const operator = await getOperator(); const timeZone = operator?.timezone?.trim() || "UTC";` (**do NOT add a raw `profiles` query**). Load recent workouts: `supabase.from("workouts").select("sport, started_at, duration_sec, strain, avg_hr").order("started_at", { ascending:false }).limit(10)` (cookie client, RLS) and render an "ACTIVITY" `Card` with `<ActivityList workouts={rows} timeZone={timeZone} />` (or an `EmptyState` "No workouts yet"), kept separate from the existing strength-session UI.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: train activity section (whoop workouts) (1B.2)`

## Task 12: Verify Health page renders Whoop data (likely no code change)

**Files:** Read `src/app/(app)/health/page.tsx`.

- [ ] **Step 1:** Confirm it renders recovery/sleep/strain/HRV/weight/steps from the latest `health_snapshots` row. If yes, **no change** — the merge-upsert populates that row and it just works. Only add/adjust copy if a metric is conspicuously unhandled. Do NOT rebuild working UI. (A recovery/strain trend sparkline is explicitly an *optional* future task, not part of this slice.)
- [ ] **Step 2:** If a change was needed, `npx tsc --noEmit`; `pnpm lint`; `pnpm build`; **Commit**. Otherwise note "verified, no change."

## Task 13: Playwright + full verification gate (incl. Google regression)

**Files:** Create `tests/e2e/whoop.spec.ts`.
**Reminder (project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

- [ ] **Step 1:** Create `tests/e2e/whoop.spec.ts` (UNAUTHENTICATED, mirror `tests/e2e/connections.spec.ts`): assert signed-out `/api/whoop/connect` redirects to `/login`. Do NOT build an auth fixture or hit Whoop.
- [ ] **Step 2: Run the full gate:**
  - `pnpm test` → all unit pass (crypto, store incl. new `buildSaveUpsert` + `buildRefreshUpdate`, google calendar, stale, whoop health, whoop workouts)
  - `npx tsc --noEmit` → 0 errors
  - `pnpm lint` → 0 errors
  - `pnpm build` → succeeds; route table shows `/api/whoop/connect`, `/api/whoop/callback`, `/api/whoop/sync`
  - `pnpm test:e2e` → green
- [ ] **Step 3: Google regression check (CODE-level, automatable now):** confirm the existing Google unit tests pass unchanged and `src/lib/integrations/store.ts` still exports `getGoogleIntegration/saveGoogleTokens/markStatus/touchLastSynced` with identical signatures (the callback/calendar call sites compile unchanged). The `buildSaveUpsert` + `buildRefreshUpdate` unit tests (Task 2) lock the save and refresh payloads (status, `last_error:null`, both tokens, merged metadata), so the Google save/refresh behavior can't silently drift. `GoogleConnectionRow.tsx` must be unchanged (Task 10 leaves it untouched). The *runtime* refresh-path check (force a Google token refresh and confirm calendar still syncs) is part of the **manual acceptance** below.
- [ ] **Step 4: Commit** — `test: e2e whoop + green full gate (1B.2)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After Max's pre-flight + deploy with `WHOOP_*` env vars set:
1. Sign in → **Settings → Connections → Connect** on Whoop → Whoop consent → approve.
2. Redirected to Settings showing **Whoop · CONNECTED**, auto-syncing.
3. **Dashboard/Health** shows real Recovery/Sleep/Strain/HRV; **Train page Activity** shows real Whoop workouts (web + mobile).
4. **Merge contract:** log a manual weight for today, run a Whoop sync, confirm the weight **survives** while recovery/strain populate the same day's row.
5. Wait ≤1h (or trigger the cron) → a fresh sync updates the current day.
6. **Disconnect** → confirm → row returns to NOT CONNECTED; reconnect works.
7. **Google regression:** confirm the live Google Calendar still renders AND still *refreshes* — wait past the Google access-token expiry (~1h) or revoke+rotate, and confirm a calendar sync still lands (this exercises the generalized refresh path).

Passing = 1B.2 done. **Next roadmap:** Strava (workouts → same `workouts` table) → Apple Health → Plaid. Gmail parked.

## Notes / deviations
- **Provider generalization:** the store is parameterized by `provider` with Google-compatible wrappers so the live Google integration is unchanged; the metadata-merge + rotating-refresh additions also harden Google.
- **Two idempotency models:** daily metrics = partial column-merge on `(user_id, date)` (shared row); workouts = plain upsert on `(user_id, source, external_id)` (single-source-owned row).
- **Whoop API:** all endpoints/scopes/response fields are **verify-at-build against developer.whoop.com** — the mappers' tested logic (rounding, drop-null-id, date assignment) is fixed; the field extraction is not.
