# X (Twitter) Follower Count Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **You are a fresh session with no prior context. Read this whole plan + the spec before starting.** The Whoop slice (1B.2) and the Strava slice are **LIVE / merged in production** and are your working templates — mirror their files (`src/lib/whoop/*`, `src/lib/strava/oauth.ts`, `src/lib/sync/strava.ts`, the `whoop`/`strava` routes, `ProviderConnectionRow`, the `social_followers` manual write path). Do **NOT** reinvent the foundation and do **NOT** break Google / Whoop / Strava (there is a regression gate at the end).
>
> **Before writing ANY X API / OAuth code, open the CURRENT docs and verify endpoints, PKCE requirements, token rotation, scopes, the confidential-vs-public client decision, and JSON field names — your training data for the X API is stale and X has changed pricing + auth repeatedly in 2026.** Specifically confirm, at build time:
> - X API pricing + the **owned-read** ($0.001) path + spending cap — https://docs.x.com/x-api/getting-started/pricing (the spec §0 is the go/no-go; re-check pricing here).
> - OAuth 2.0 Authorization-Code **+ PKCE** (the genuinely-new bit) — https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code (auth endpoint `https://x.com/i/oauth2/authorize`, token endpoint `https://api.x.com/2/oauth2/token`; PKCE `code_challenge`/`code_verifier` S256 is MANDATORY; `offline.access` to receive a refresh token; refresh tokens are **single-use and rotate**).
> - `GET /2/users/me?user.fields=public_metrics` returning `public_metrics.followers_count` (the one read) — https://docs.x.com/x-api/users/get-me . **App-only Bearer is 403'd on `/2/users/me`** — you MUST use OAuth 2.0 user context (PKCE). See spec §0.
> - **Confidential vs public client** — confirm Max's app type at build (spec §11 fork): confidential → HTTP Basic `Authorization: Basic base64(client_id:client_secret)` on token requests; public → `client_id` in the form body, NO Basic header, NO `X_CLIENT_SECRET`. The lib MUST handle a missing `X_CLIENT_SECRET` gracefully (public client) and NOT throw at startup.

**Goal:** Max connects **X** once from Settings (the same one-click OAuth flow as Google / Whoop / Strava). After that, his **X follower count** auto-populates the existing **Social module** that today he updates by hand — one fresh number per day, tagged `source='api'`. The count lands in the **existing `social_followers` table** (`platform='X'`), kept current by a **daily** background cron. **Zero schema change, zero new UI** — the Social card already renders `platform='X'` rows; this slice just stops Max from typing the number in manually.

**Architecture:** X is a **near-pure consumer** of the merged Whoop/Strava foundation, with **one genuinely-new piece: PKCE in the OAuth lib.** It adds a provider through the already-generalized token store (`getIntegration`/`saveTokens`/`persistRefreshedTokens`/`markStatusFor`/`touchLastSyncedFor`, `buildSaveUpsert`/`buildRefreshUpdate` — all provider-parameterized; widen the `Provider` union by one literal), the AES-256-GCM crypto, the `ProviderConnectionRow` (add `x` cases to its action switch), the `sync_runs`/`error_events` observability, and the constant-time `CRON_SECRET` cron. The only genuinely new code is `src/lib/x/oauth.ts` (auth-code **+ PKCE**), `src/lib/x/client.ts`, the one-line pure `mapFollowerCount` (`src/lib/x/social.ts` + tests), `src/lib/sync/x.ts` (a **single scalar** sync — even simpler than Strava's single stream), three routes, and a daily cron entry. **No migration:** the `social_followers` table already whitelists `'X'` in its `platform` CHECK and `'api'` in its `source` CHECK (provisioned for exactly this), and `integrations.provider` is free-text.

**Tech Stack:** Next.js 16 (App Router route handlers), React 19 server components, Supabase (`@supabase/ssr` cookie client + `@supabase/supabase-js` service-role admin client), Node `crypto` (reuse AES-256-GCM token encryption; use `crypto.createHash`/`randomBytes` for PKCE), Zod, Vitest, Playwright, Vercel Cron (Pro).

**Spec:** `docs/superpowers/specs/2026-06-08-personal-os-x-twitter-social-design.md` (read it — §0 is the go/no-go on cost + the OAuth-user-context requirement; §3c is the field-mapping contract; §4 the component shapes; §11 the forks). The spec template is `docs/superpowers/specs/2026-06-05-personal-os-strava-design.md`.

**Foundation templates (read these first — you will mirror them):**
- `src/lib/integrations/store.ts` — provider-aware token store (reused **as-is**, no change; `Provider` type is `"google" | "whoop" | "strava"` → widen to include `"x"`). `persistRefreshedTokens` already handles a rotated refresh token (pass `refreshToken`).
- `src/lib/whoop/oauth.ts` — OAuth lib pattern with **rotating refresh** (X rotates exactly like Whoop). Task 1 mirrors it AND **adds PKCE** + the confidential/public-client branch.
- `src/lib/strava/oauth.ts` — a second rotating-refresh reference (single-stream sibling).
- `src/lib/whoop/client.ts` — authed fetch + `WhoopApiError` (Task 2 mirrors the fetch/error shape; NO pagination — `/2/users/me` is a single object).
- `src/lib/whoop/workouts.test.ts` — the pure-mapper TDD shape (Task 3 mirrors this for `mapFollowerCount`).
- `src/lib/sync/strava.ts` — the **single-stream** sync core (refresh-before-use, `sync_runs`/`error_events` logging). Task 4 mirrors it but collapses the stream to **one scalar + one upsert**.
- `src/lib/sync/whoop.ts` — reference for the proactive-refresh + mid-fetch-401 retry + write-before-use detail.
- `src/app/api/whoop/{connect,callback,sync}/route.ts` — the three routes (Tasks 5–7). The `connect` route's cookie pattern + the `sync` route's `authMatches` constant-time `CRON_SECRET` check are copied.
- `src/app/(app)/settings/ProviderConnectionRow.tsx`, `ConnectionsCard.tsx`, `_actions/connections.ts` (Task 8).
- `src/app/(app)/_actions/social.ts` — the **manual `logFollowers` upsert** (`onConflict: "user_id,platform,date"`) the cron mirrors, differing only in `source: 'api'`.
- `src/components/modules/SocialCard.tsx` (Task 9 — verify-only; it already selects `platform, count, date` with NO `source` filter).
- `src/lib/crypto/tokens.ts` (reused as-is), `src/lib/env.ts` (Task 0), `src/lib/supabase/admin.ts` (reused), `src/lib/format.ts` (`todayISO()` for the UTC day-key).

---

## Pre-flight — Max's one-time X setup (~15–20 min — BLOCKS Tasks 5–7 live test; everything else can be built without it)

> **Lead time: immediate, BUT requires a billing card — there is NO free path for a new X developer (spec §0).** Creating an X developer app is self-service, but the pay-per-use model requires a payment method / prepaid credit balance before any read succeeds. **Cost to expect: pennies per year** (~$0.03/mo at daily cadence; ~$0.36/yr), but a card on file + a spending cap is **mandatory**.

1. Sign in to X → **X Developer Portal** (developer.x.com) → create a developer account if needed (agree to the developer terms).
2. **Add billing / buy credits.** In the Developer Portal billing section, add a payment method and (if required) purchase a small starter credit balance. **Set a per-billing-cycle spending cap (e.g. `$1/month`)** as a hard backstop — this slice will only ever spend cents. **This step is non-negotiable: without a credit balance, every read 402s/403s.**
3. **Create a Project + App** (a Project is required to use API v2).
4. In the App's **User authentication settings**, enable **OAuth 2.0**:
   - **Type of App:** **Web App / Confidential client** (gives a Client Secret). *(If you create a public client instead, there is no secret — the lib supports that; see the §11 fork + Task 1.)*
   - **App permissions:** **Read** (we only read).
   - **Callback URI / Redirect URL:** add **`https://personal-os-azure-eight.vercel.app/api/x/callback`** AND (for local dev) **`http://localhost:3000/api/x/callback`** — X allows multiple callback URLs, so register both (no single-domain restriction like Strava had).
   - **Website URL:** `https://personal-os-azure-eight.vercel.app`.
5. Save. Copy the **Client ID** and (for a confidential app) the **Client Secret** from the **Keys and tokens** tab.
6. Set in Vercel (Production) **and** `.env.local`:
   - `X_CLIENT_ID` = the OAuth 2.0 Client ID
   - `X_CLIENT_SECRET` = the OAuth 2.0 Client Secret (**omit entirely if public client** — the lib must not require it)
   - `X_OAUTH_REDIRECT_URI` = `https://personal-os-azure-eight.vercel.app/api/x/callback` (use the `http://localhost:3000/...` value in `.env.local`)
   - Reuse the already-set `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. **Redeploy.**
7. Scopes (`tweet.read users.read offline.access`) are requested by our app on the consent screen, not configured in the portal.

> **DECISION FOR MAX (must resolve before the build wires the token-request auth) — confidential vs public OAuth client (spec §11 fork).**
> - **(a) Recommended — confidential Web App:** Client ID **+** Client Secret; token requests use HTTP Basic auth. Server-side, matches the Whoop/Google/Strava pattern.
> - **(b) Public client:** Client ID only, no secret; token requests send `client_id` in the body and NO Basic header.
>
> **The lib in Task 1 supports BOTH at runtime** (it branches on whether `X_CLIENT_SECRET` is present) — so the build is not blocked on this decision, but **confirm the app type before the live OAuth test** so the wrong auth header isn't discovered mid-acceptance.
>
> **Other forks carried forward from spec §11 (recommend the default; Max decides — do NOT block):** OAuth2-PKCE (default) vs app-only Bearer (rejected on `/2/users/me`, so PKCE is effectively forced); follower-count-only (default — the only thing `social_followers` can hold without a migration) vs engagement (separate future slice); daily cron (default) vs hourly (pointless for a follower count); **manual-vs-API precedence on the shared daily row → "API overwrites"** (the cron silently replaces any same-day manual X figure; it's a count, not a judgement call).
>
> The env getters throw only at call time, so the build + all non-live tasks below work without any of these set.

---

## File structure

**Create:**
- `src/lib/x/oauth.ts` — X OAuth 2.0 auth-code flow **+ PKCE** (`generatePkce` / consent / exchange / **refresh-returning-rotated-token**) + confidential/public-client token-auth branch + `XAuthError`.
- `src/lib/x/client.ts` — authed X fetch helper + `XApiError` + `getMe(accessToken)` (single object, NO pagination).
- `src/lib/x/social.ts` — the pure `mapFollowerCount(raw): number | null` (the spec-§11(a) advisory: the mapper lives HERE, in `src/lib/x/social.ts`).
- `src/lib/x/social.test.ts` — the TDD'd `mapFollowerCount` unit tests (written FIRST).
- `src/lib/sync/x.ts` — `syncX(client, userId)` (single scalar, refresh-before-use, no-clobber skip, logging).
- `src/app/api/x/connect/route.ts`
- `src/app/api/x/callback/route.ts`
- `src/app/api/x/sync/route.ts`
- `tests/e2e/x.spec.ts`

**Modify:**
- `src/lib/integrations/store.ts` — widen `Provider` type to include `"x"` (one-line union change; **this is the ONLY store edit** — every function is already provider-parameterized).
- `src/lib/env.ts` — add `getXClientId`, `getXClientSecret` (returns `string | undefined` — public client has no secret), `getXOauthRedirectUri`.
- `src/app/(app)/settings/_actions/connections.ts` — add `disconnectX`, `syncXNow`.
- `src/app/(app)/settings/ProviderConnectionRow.tsx` — add the `x` cases to its disconnect/sync action switch (do NOT fork a new component).
- `src/app/(app)/settings/ConnectionsCard.tsx` — load `getIntegration(supabase, userId, "x")` + render a live X row.
- `.env.example` — document `X_*`.
- `vercel.json` — add the daily X cron.

**Verify-only (no change expected):**
- `src/components/modules/SocialCard.tsx` — confirm the Social query (`select("platform, count, date")`, `.order("date", { ascending: false })`) reads X rows **regardless of `source`** — it does NOT filter `source='manual'`, so an `source='api'` row renders automatically and (rows being date-desc, first-seen-wins) the latest count per platform wins. **No change expected.** (Task 9.)

---

## Task 0: X env getters + Provider type

**Files:** Modify `src/lib/env.ts`, `src/lib/integrations/store.ts`, `.env.example`.

- [ ] **Step 1:** In `src/lib/env.ts`, add (mirroring `getWhoopClientId`/`getWhoopOauthRedirectUri`, BUT `getXClientSecret` returns `string | undefined` — a **public client has no secret** and the lib must NOT throw when it's absent; spec §11(b) advisory):

```ts
export function getXClientId(): string { return requireEnv("X_CLIENT_ID"); }
/** Optional: a PUBLIC OAuth client has no secret. Returns undefined when unset
 * (the oauth lib then uses public-client token requests). NEVER throws on absence. */
export function getXClientSecret(): string | undefined { return process.env.X_CLIENT_SECRET || undefined; }
export function getXOauthRedirectUri(): string { return requireEnv("X_OAUTH_REDIRECT_URI"); }
```

- [ ] **Step 2:** In `src/lib/integrations/store.ts`, widen the provider union (the ONLY store change — every function is already provider-parameterized):

```ts
export type Provider = "google" | "whoop" | "strava" | "x";
```

- [ ] **Step 3:** Append to `.env.example`:

```
# X (Twitter) OAuth 2.0 app (developer.x.com) — requires a billing card + spending cap (no free tier)
X_CLIENT_ID=your-x-oauth2-client-id
# Omit X_CLIENT_SECRET entirely if the X app is a PUBLIC client (no secret)
X_CLIENT_SECRET=your-x-oauth2-client-secret
X_OAUTH_REDIRECT_URI=http://localhost:3000/api/x/callback
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean. **Commit** — `feat: x env getters + provider type (1B X social)`

## Task 1: X OAuth lib (auth-code + PKCE + rotating refresh + confidential/public client)

**Files:** Create `src/lib/x/oauth.ts`.
**Docs (READ FIRST — verify endpoints, PKCE, the rotated refresh_token behavior, the `offline.access` scope, and the confidential-vs-public token-auth):** https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code

Mirror `src/lib/whoop/oauth.ts` (NOT Google — X rotates the refresh token like Whoop) **AND add PKCE + the confidential/public-client branch — this is the one genuinely-new piece of the slice.** X-specific differences to confirm/implement:

- **Endpoints:** auth `https://x.com/i/oauth2/authorize` (alias of `https://twitter.com/i/oauth2/authorize`); token `https://api.x.com/2/oauth2/token` (POST, `x-www-form-urlencoded`). **Verify at build.**
- `X_SCOPES = ["tweet.read", "users.read", "offline.access"] as const` — read-only; **`offline.access` is MANDATORY** to receive a refresh token at all (and must be re-sent on refresh to keep getting a rotated one). **Space-joined** in the consent URL (`X_SCOPES.join(" ")`).
- **`generatePkce()` → `{ verifier, challenge }`** (the new bit). Use `node:crypto`:
  - `verifier` = high-entropy URL-safe random string (e.g. `randomBytes(32)` → base64url, 43–128 chars per RFC 7636).
  - `challenge` = base64url(`createHash("sha256").update(verifier).digest()`) — i.e. S256. (No padding; `+`→`-`, `/`→`_`, strip `=`.)
- **`buildConsentUrl(state, codeChallenge)`** params: `response_type=code`, `client_id`, `redirect_uri`, `scope` (space-joined), `state`, **`code_challenge`**, **`code_challenge_method=S256`**.
- **Token-request auth helper (confidential vs public — spec §11(b)).** A private helper builds the `fetch` for the token endpoint: if `getXClientSecret()` is present → add header `Authorization: Basic ` + `Buffer.from(`${clientId}:${clientSecret}`).toString("base64")` (confidential client); if absent → NO Basic header and include `client_id` in the **form body** (public client). **Either way, do NOT throw when the secret is absent.**
- **`exchangeCode(code, codeVerifier)` → `{ accessToken, refreshToken, expiresAt, xUserId?, username? }`:** POST `grant_type=authorization_code`, `code`, `redirect_uri`, **`code_verifier`** (the PKCE proof), plus the client auth (Basic header OR `client_id` in body per above). Compute `expiresAt = Date.now() + expires_in*1000` (epoch ms — store convention). **Throw `XAuthError` if no `refresh_token`** (means `offline.access` was dropped → re-consent). *(Note: the token response does NOT include the user id/handle; those come from the `getMe` call in the callback — leave `xUserId`/`username` optional/undefined here and stash from `getMe` in the callback. If a future check shows the token response carries an `id`, return it; otherwise rely on `getMe`.)*
- **`refreshTokens(refreshToken)` → `{ accessToken, refreshToken, expiresAt }`** — POST `grant_type=refresh_token`, `refresh_token`, plus client auth (Basic OR `client_id` in body). **X ROTATES the refresh token (single-use); RETURN the new `refresh_token`** (exactly like Whoop; unlike Google). Re-send `scope` if X requires it to keep rotating (verify at build). **Throw `XAuthError` if no rotated `refresh_token`** (the just-used one is now dead — persisting nothing would brick the connection).
- **`XAuthError extends Error`** with `status`, `body` (mirror `WhoopAuthError`; truncate body; **never log tokens**).

- [ ] **Step 1:** Implement per above (no unit test — thin HTTP wrapper + PKCE; covered by manual OAuth at acceptance). Keep the file `"server-only"`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: x oauth lib (auth-code + PKCE + rotating refresh) (1B X social)`

## Task 2: X client (single-object fetch, no pagination)

**Files:** Create `src/lib/x/client.ts`.
**Docs (READ FIRST):** https://docs.x.com/x-api/users/get-me — `GET /2/users/me`, the `user.fields=public_metrics` param, and the response shape (`{ data: { id, name, username, public_metrics: { followers_count, following_count, tweet_count, listed_count } } }` — a single object, NOT a paginated collection).

Mirror the fetch + typed-error shape of `src/lib/whoop/client.ts` (`WhoopApiError` → `XApiError` with `status`; truncate the error body to ~200 chars). **No pagination** — this is the structural simplification vs Whoop (one object response).

- `X_API_BASE = "https://api.x.com/2/"`.
- `XApiError extends Error` with `status` (so the sync core can branch on 401).
- `xFetch<T>(accessToken, path, params)` → parsed JSON; header `Authorization: Bearer <user access token>`; throw `XApiError` on non-OK (truncate body).
- `getMe(accessToken)` → `xFetch("users/me", { "user.fields": "public_metrics" })` → returns the parsed JSON (the `mapFollowerCount` mapper extracts the number). Type the return loosely (`unknown`/a small interface) so the pure mapper owns the shape contract.

- [ ] **Step 1:** Implement per above (no unit test — thin HTTP wrapper, covered at manual acceptance).
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: x client + getMe (1B X social)`

## Task 3: `mapFollowerCount` — TDD (the one unit-tested piece)

**Files:** Create `src/lib/x/social.ts`, `src/lib/x/social.test.ts`.
**Docs (READ FIRST):** https://docs.x.com/x-api/users/get-me — confirm `data.public_metrics.followers_count` is the EXACT path/key (verify before wiring; the test pins the contract logic, you wire the real field name).

Per spec §3c + the §11(a) advisory: **the mapper lives in `src/lib/x/social.ts`.** Pure `mapFollowerCount(raw): number | null` — extracts `raw.data.public_metrics.followers_count`; returns it **only if it is a finite, non-negative integer**, else `null` (→ the sync core SKIPS the write, so a malformed/empty read never clobbers a good prior count with `0`/`NaN`). No `user_id`/`platform`/`source`/`date` here — the mapper is a pure scalar extractor; the sync core builds the row.

- [ ] **Step 1: Failing tests** in `src/lib/x/social.test.ts` (mirror the pure-mapper shape of `src/lib/whoop/workouts.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { mapFollowerCount } from "./social";

describe("mapFollowerCount", () => {
  it("extracts a positive followers_count", () => {
    expect(
      mapFollowerCount({ data: { id: "1", username: "max", public_metrics: { followers_count: 1234, following_count: 50, tweet_count: 9, listed_count: 2 } } }),
    ).toBe(1234);
  });

  it("returns 0 for a real zero count (a valid value, not a skip)", () => {
    expect(
      mapFollowerCount({ data: { public_metrics: { followers_count: 0 } } }),
    ).toBe(0);
  });

  it("returns null when public_metrics is missing (skip the write — don't clobber)", () => {
    expect(mapFollowerCount({ data: { id: "1", username: "max" } })).toBeNull();
  });

  it("returns null when followers_count is missing/non-numeric/negative", () => {
    expect(mapFollowerCount({ data: { public_metrics: {} } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: "1234" as unknown as number } } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: Number.NaN } } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: -5 } } })).toBeNull();
  });

  it("returns null on a malformed/empty response", () => {
    expect(mapFollowerCount({})).toBeNull();
    expect(mapFollowerCount(null as unknown as object)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/x/social.test.ts` (FAIL: `mapFollowerCount` not implemented).
- [ ] **Step 3: Implement** `mapFollowerCount` per the contract: read `raw?.data?.public_metrics?.followers_count`; return it iff `Number.isInteger(n) && n >= 0`; else `null`. (`0` is a VALID count — it returns `0`, NOT `null`. Only missing/non-integer/negative → `null`.) Confirm the exact JSON key against the live docs and fix any extraction mismatch.
- [ ] **Step 4: Run → pass** — `npx vitest run src/lib/x/social.test.ts`; `npx tsc --noEmit`. **Commit** — `feat: x mapFollowerCount (TDD) (1B X social)`

## Task 4: X sync core (single scalar, refresh-before-use, no-clobber skip)

**Files:** Create `src/lib/sync/x.ts`.
Mirror `src/lib/sync/strava.ts` (the **single-stream** sibling) but collapse the stream to **one read → one scalar → one upsert (or skip)**. Reference `src/lib/sync/whoop.ts` for the proactive-refresh + mid-fetch-401 + write-before-use detail. **Key behaviors:**

- `SYNC_PROVIDER = "x" as const` (recorded on `sync_runs.provider` + `error_events.provider`). `REFRESH_SKEW_MS = 60_000`.
- `syncX(client, userId)` (use the PASSED client — never create one; the admin/cron client bypasses RLS, so every read/write is explicitly scoped by `user_id`):
  - `getIntegration(client, userId, "x")`; if none → return `{ ok:false, status:"error", synced:0 }`.
  - `readTokens(integration)`; if no access token → `markStatusFor(.., "expired", "Missing access token")` + failed `sync_runs` + return.
- **Refresh handling (the real risk — runs ~daily here because X access tokens are short-lived ~2h, so the overnight gap almost always expires them):**
  - `metadata.expires_at` is **epoch MILLISECONDS** (the oauth lib already stored `Date.now() + expires_in*1000`). Compare against `Date.now() + REFRESH_SKEW_MS`.
  - **Guard the refresh token first:** if `expires_at` is past/within skew AND `!refreshToken` → `markStatusFor(.., "expired", "Missing refresh token")` + failed `sync_runs` + return.
  - If expired/within skew: `refreshTokens(refreshToken)` → `persistRefreshedTokens(client, userId, "x", refreshed)` **BEFORE using the new access token** (write-before-use — X invalidates the old refresh token the instant it's used; a failed persist must not leave us using an unpersisted token, which would permanently brick the connection).
  - Also catch a **401 mid-fetch** and refresh-retry **once** (same refresh-token guard); a second 401 propagates.
  - On any refresh failure → `markStatusFor(.., "expired", msg)` + failed `sync_runs` + return (do NOT throw; an auth failure raises the reconnect banner, a data hiccup does not).
- **The single read + write:** `getMe(accessToken)` → `mapFollowerCount(raw)`:
  - **If `null` (malformed/empty/non-numeric read):** KEEP `integrations.status='connected'`, record `error_events { user_id, provider:"x", severity:"error", message, context:{ stage: "syncXFollowers" } }`, write a **`partial`** `sync_runs` row, and **do NOT write** to `social_followers` (never clobber a good prior count with a bad read). Return `{ ok:false, status:"error"/"partial", synced:0 }` — a data hiccup must NOT flip to `expired`.
  - **Else (a valid count, incl. `0`):** upsert `{ user_id, platform: "X", date: todayISO(), count, source: "api" }` into `social_followers` with `onConflict: "user_id,platform,date"` (mirrors the manual `logFollowers` path; differs only in `source:'api'`). This touches ONLY the `platform='X'` row — never LINKEDIN/SUBSTACK/GITHUB/IG. **Per the §3b "API overwrites" decision, the cron silently replaces any same-day manual X figure.**
  - **Date key:** use `todayISO()` from `@/lib/format` (UTC day-key, matching the cron schedule's UTC). One row per UTC day.
- **Finish (success):** `touchLastSyncedFor(client, userId, "x")`; write `sync_runs { user_id, provider:"x", started_at, finished_at, rows_synced: 1, status:"ok" }`. Return `{ ok:true, status:"ok", synced:1 }`. (`sync_runs.status ∈ {ok,partial,failed}`, `error_events.severity ∈ {info,warn,error}` — confirm against `supabase/migrations/20260527120012_create_observability.sql`.)
- **NEVER writes `health_snapshots` or `workouts`** — the only write target is `social_followers` (`platform='X'`, `source='api'`).

- [ ] **Step 1:** Implement per above. Write a small `writeSyncRun` helper like Strava/Whoop.
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: x sync core (single scalar, refresh-before-use, no-clobber) (1B X social)`

## Task 5: `/api/x/connect` route (PKCE — sets TWO cookies)

**Files:** Create `src/app/api/x/connect/route.ts`.
**Mirror `src/app/api/whoop/connect/route.ts`, with the PKCE addition:** import `buildConsentUrl` + `generatePkce` from `@/lib/x/oauth`; keep the `getCurrentUserId` guard → `/login` redirect for signed-out; `randomBytes(16).toString("hex")` state. **The new bit:** call `generatePkce()`, redirect to `buildConsentUrl(state, challenge)`, and set **TWO** short-lived httpOnly cookies so the callback can verify state AND replay the verifier:
- `x_oauth_state` = state
- `x_pkce_verifier` = the PKCE `verifier`

Both with `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `maxAge: 600`, `path: "/"`. **Distinct names** (`x_oauth_state` / `x_pkce_verifier`) so they can't collide with `google_/whoop_/strava_oauth_state`.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build` compiles the route. **Commit** — `feat: x connect route (PKCE, two cookies) (1B X social)`

## Task 6: `/api/x/callback` route + inline first sync

**Files:** Create `src/app/api/x/callback/route.ts`. `export const maxDuration = 60;`
**Mirror `src/app/api/whoop/callback/route.ts`, with the PKCE + metadata additions:**
- Read **both** cookies: `x_oauth_state` and `x_pkce_verifier`. Verify `state === x_oauth_state` (the existing one-time-state check); also require `x_pkce_verifier` to be present.
- `exchangeCode(code, verifier)` from `@/lib/x/oauth` (pass the PKCE verifier).
- `getCurrentUserId` guard → `/login`.
- After exchange, call `getMe(tokens.accessToken)` once to capture the X user id + handle, then `saveTokens(supabase, userId, "x", tokens, { x_user_id, username })` (stash the X user id + handle in metadata — handy for display + debugging; the spec §4 callback notes this). *(If `getMe` here would double the cost concern: the inline `syncX` below ALSO calls `getMe`. Acceptable — connect happens rarely and it's still an owned read. Alternatively skip this extra call and let `syncX` populate everything; the id/handle in metadata is a nice-to-have, not required. Recommend the single extra call at connect for the metadata, since it's pennies and rare.)*
- Run `syncX(supabase, userId)` **inline** so today's follower count lands immediately on return.
- **Clear BOTH cookies on every exit path** (extend the Whoop `finish()` helper to delete `x_oauth_state` AND `x_pkce_verifier`).
- Redirects: `/settings?connected=x` (success) / `?error=x` (exchange/sync throw) / `?error=x_state` (state/verifier mismatch/missing). On the catch path, best-effort `markStatusFor(supabase, userId, "x", "error", ...)` like Whoop.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit`; `pnpm build`. **Commit** — `feat: x callback + inline first sync (PKCE) (1B X social)`

## Task 7: `/api/x/sync` cron route + `vercel.json`

**Files:** Create `src/app/api/x/sync/route.ts` (`export const maxDuration = 60;`); Modify `vercel.json`.
**Mirror `src/app/api/whoop/sync/route.ts`, changing:** **reuse its `authMatches` constant-time `CRON_SECRET` check (copy it VERBATIM — do NOT regress to `===`)**; select `integrations` where `provider="x" AND status="connected"`; call `syncX(admin, row.user_id)` per user in an isolated try/catch (one throw must NOT abort the batch); count `ok` vs `failed`; return `Response.json({ ok:true, synced, failed })`.

- [ ] **Step 1:** Implement the route (service-role admin client via `createAdminClient()`; every read/write explicitly scoped by `user_id`).
- [ ] **Step 2:** In `vercel.json`, add a fourth cron entry — **daily** (`0 7 * * *`, ~07:00 UTC; spec §5 default). A follower count needs only daily freshness, and daily = exactly one billed owned read/day (~$0.03/mo):

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [
  { "path": "/api/google-calendar/sync", "schedule": "*/5 * * * *" },
  { "path": "/api/whoop/sync", "schedule": "0 * * * *" },
  { "path": "/api/strava/sync", "schedule": "0 * * * *" },
  { "path": "/api/x/sync", "schedule": "0 7 * * *" }
] }
```

> **Note:** keep the existing google-calendar / whoop / strava entries; only ADD the X line. Vercel Pro allows up to 40 crons, so four entries are fine.

- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm build` (route table shows `/api/x/sync`). **Commit** — `feat: x cron sync + vercel.json daily (1B X social)`

## Task 8: Live X connection row + actions

**Files:** Modify `src/app/(app)/settings/_actions/connections.ts`, `src/app/(app)/settings/ProviderConnectionRow.tsx`, `src/app/(app)/settings/ConnectionsCard.tsx`.

- [ ] **Step 1:** Add to `_actions/connections.ts` (mirror `disconnectWhoop`/`syncWhoopNow`):
  - `disconnectX()` — delete integration where `provider='x'`, revalidate `/settings` + `/dashboard`.
  - `syncXNow()` — `syncX(supabase, userId)`, revalidate `/dashboard` + `/settings` (the Social card renders on `/dashboard`).
- [ ] **Step 2:** In `ProviderConnectionRow.tsx`, **add the `x` cases** to the existing provider-keyed action selection (it currently does `provider === "whoop" ? disconnectWhoop : disconnectGoogle` — generalize to include `strava` and `x`; import `disconnectX`/`syncXNow`). The `?connected=<provider>` post-connect trigger already matches the row's own `provider` (works for `x` unchanged). **Do NOT fork a new component** — `ProviderConnectionRow` is already generalized; X is one more case. Leave `GoogleConnectionRow.tsx` untouched.
- [ ] **Step 3:** In `ConnectionsCard.tsx`, also `getIntegration(supabase, userId, "x")` and render an X row via `ProviderConnectionRow` (`provider="x"`, `label="X"`, `sub="SOCIAL"`, `connectPath="/api/x/connect"`, `status`, `syncedLabel` via `staleAgeLabel`, `lastError`). X is not in `PENDING_PROVIDERS` (only Plaid + Health Auto Export are) — no placeholder to remove; leave those two as static `NOT CONNECTED`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: live x connection row + actions (1B X social)`

## Task 9: Social card — verify provider-agnostic + source-agnostic (verify-only)

**Files:** Read (likely NO change) `src/components/modules/SocialCard.tsx`.

> **This is the one place a `source='manual'` assumption could hide the API-written X row.** The Social card built for manual entry reads `social_followers`; the API row writes into the SAME table with `source='api'`, so it should appear automatically — UNLESS the query filtered to `source='manual'`.

- [ ] **Step 1:** Open `src/components/modules/SocialCard.tsx` and inspect the query. **Confirmed at plan time:** it does `.select("platform, count, date").order("date", { ascending: false })` with **NO `.eq("source", ...)` filter** — so an `source='api'` X row renders automatically, and because rows are date-desc and the card takes first-seen-per-platform, today's API row (latest `date`) wins over an older manual one. **No change expected.**
  - If a future edit added a `source='manual'` filter → widen it (remove the `.eq("source", ...)`). One-line change.
- [ ] **Step 2 (OPTIONAL — flag, not required for acceptance):** a small "auto" badge on API-sourced rows would distinguish the auto-filled X count from manual entries. Note as optional follow-up (the card would need to also select `source`); do NOT block on it.
- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** (only if a change was actually needed) — `fix: social card reads X rows source-agnostically (1B X social)`. Otherwise note "verified source-agnostic, no change."

## Task 10: Playwright + full verification gate (incl. Google/Whoop/Strava regression)

**Files:** Create `tests/e2e/x.spec.ts`.
**Reminder (project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

- [ ] **Step 1:** Create `tests/e2e/x.spec.ts` (UNAUTHENTICATED, mirror `tests/e2e/whoop.spec.ts`): assert signed-out `/api/x/connect` redirects to `/login`. Do NOT build an auth fixture or hit X.
- [ ] **Step 2: Run the full gate:**
  - `pnpm test` → all unit pass (crypto, store incl. `buildSaveUpsert`/`buildRefreshUpdate`, google calendar, stale, whoop health, whoop workouts, strava `mapActivity`, **x `mapFollowerCount`**).
  - `npx tsc --noEmit` → 0 errors.
  - `pnpm lint` → 0 errors.
  - `pnpm build` → succeeds; route table shows `/api/x/connect`, `/api/x/callback`, `/api/x/sync`.
  - `pnpm test:e2e` → green.
- [ ] **Step 3: Google/Whoop/Strava regression check (CODE-level, automatable now):**
  - The store change is a **type-union widening only** (`Provider` += `"x"`); all existing `getGoogleIntegration`/`saveGoogleTokens`/`markStatus`/`touchLastSynced` and the Whoop/Strava call sites compile unchanged. Confirm the Google + Whoop + Strava unit tests (`store.test.ts`, `whoop/health.test.ts`, `whoop/workouts.test.ts`, `strava/workouts.test.ts`) all pass **unchanged**.
  - `GoogleConnectionRow.tsx` must be byte-for-byte unchanged. `ProviderConnectionRow.tsx` gained an `x` case but the `google`/`whoop`/`strava` cases are untouched.
  - **CRITICAL — Social read path:** re-confirm (Task 9) `SocialCard.tsx` reads X rows source-agnostically so the API-written `source='api'` X row shows (and supersedes the manual one for the day).
  - **No-clobber / no-cross-write:** confirm `src/lib/sync/x.ts` writes ONLY `social_followers` (`platform='X'`) — NO `health_snapshots`, NO `workouts` write path; and a `null` mapper result SKIPS the write (records a `partial` `sync_run` only).
  - The *runtime* refresh-path checks (Google ~1h, Whoop 6h, Strava 6h, **X ~2h**) are part of **manual acceptance** below.
- [ ] **Step 4: Commit** — `test: e2e x + green full gate (1B X social)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After Max's pre-flight (Client ID [+ Secret if confidential] + redirect URI set in Vercel + `.env.local`, billing card + spending cap set, confidential-vs-public decision resolved) + deploy:
1. Sign in → **Settings → Connections → Connect** on X → X consent screen (`tweet.read users.read offline.access`) → approve.
2. Redirected to Settings showing **X · CONNECTED**, auto-syncing; the inline first sync writes today's follower count into `social_followers` (`platform='X'`, `source='api'`).
3. **Social card** (dashboard, web + mobile) shows the real X follower count — replacing any manual figure for the day, and folded into the total-followers number.
4. **Daily cron:** the next day (after ~07:00 UTC), confirm the X count refreshes (or trigger `/api/x/sync` with the `CRON_SECRET`).
5. **Refresh-path check (THE real risk — runs ~daily here):** let the ~2h access token expire (it will, overnight), then run a sync → confirm it still lands. This exercises the **rotated-refresh-token persist-before-use** path. A botched rotation would permanently brick the connection, and because X access tokens are short-lived this path runs almost every day (more often than Strava's ~6h / every-6th-sync).
6. **No-clobber check:** confirm a malformed/empty `public_metrics` read does NOT write a `0` over a good prior count (it records a `partial` `sync_run` and skips the write), and that an X write only touches the `platform='X'` row (never LINKEDIN/SUBSTACK/GITHUB/IG).
7. **Disconnect** → confirm → row returns to NOT CONNECTED; **reconnect** works.
8. **Revoke-at-source check:** revoke the app's access at X (Settings → Connected apps) and confirm the **reconnect banner appears within ~1 cycle (≤1 day)** — the next daily sync's refresh fails → `status='expired'`.
9. **Google / Whoop / Strava regression (runtime):** confirm Google Calendar still renders + refreshes (~1h), Whoop Health/Activity still render + refresh (6h), and Strava activities still render + refresh (6h). All share the generalized store/refresh path X reused.

Passing = the X slice is done. **Cost check:** confirm the X Developer Console shows ~$0.001/day of owned-read spend and the spending cap is in place.

## Notes / deviations

- **Near-pure consumer + ONE new idea (PKCE):** X adds a provider with almost zero new foundation — the only store edit is a one-line `Provider` union widening; the token store, crypto, `ProviderConnectionRow`, `sync_runs`/`error_events`, and the constant-time cron are all reused. The single genuinely-new piece is **PKCE in `src/lib/x/oauth.ts`** (`generatePkce` S256 + the `code_challenge`/`code_verifier` round-trip via the `x_pkce_verifier` cookie). This slice proves the foundation generalizes to a social-metrics provider AND to a PKCE OAuth flow.
- **Smallest slice in 1B:** one scalar (a follower count), one row per day, one read call, one upsert. Even simpler than Strava's single workout stream — there is no mapper-array, no pagination, no second table.
- **Zero migration:** `social_followers` already whitelists `'X'` (`platform` CHECK) and `'api'` (`source` CHECK), and `integrations.provider` is free-text. No DB change, no `database.types.ts` regen.
- **The mapper lives in `src/lib/x/social.ts`** (spec §11(a) advisory), is the ONLY unit-tested unit (`mapFollowerCount`), and is a pure scalar extractor — `0` is a valid count, only missing/non-integer/negative → `null` → SKIP the write (no-clobber).
- **Confidential OR public client (spec §11(b) advisory):** the oauth lib branches at runtime on whether `X_CLIENT_SECRET` is present — confidential adds HTTP Basic on token requests; public sends `client_id` in the body. **It does NOT throw at startup when the secret is absent.** Confirm the app type at build before the live OAuth test.
- **Rotated refresh token is the highest-risk path and runs ~daily:** X access tokens are short-lived (~2h), so the overnight gap almost always expires them — the rotated-refresh-token write-before-use path runs nearly every sync (more often than Strava). A botched rotation permanently bricks the connection; the write-before-use ordering (persist the rotated pair BEFORE using the new access token) is load-bearing.
- **API overwrites on the shared daily row (spec §3b):** the cron silently replaces any same-day manual X figure — the whole point is to stop manual entry. It's a count, not a judgement call.
- **Cost (verified 2026-06-08, re-check at build):** one owned read/day = $0.001/day ≈ $0.03/mo (~$0.36/yr); owned reads dedupe within a 24h UTC window so a daily pull is exactly one billed resource. A `$1/mo` spending cap in the X Developer Console is the hard backstop. **No free path for a new developer — a billing card is mandatory.**
- **Engagement is out of scope (spec §9):** no home table (`social_followers` holds only a daily count) and engagement reads are pricier standard reads — a separate future slice with its own table + UI.
- **X API:** all endpoints/scopes/response fields are **verify-at-build against docs.x.com** — the `mapFollowerCount` tested logic (extract `followers_count`, integer/non-negative guard, null-skip, `0` is valid) is fixed; the field extraction + token-endpoint host + PKCE param names are not, and X has changed pricing + auth repeatedly in 2026.
- **Optional, deferred (flagged, not in acceptance):** an "auto" badge on API-sourced Social rows; calling X's token-revocation endpoint on disconnect (vs just deleting the local integration row); capturing `verified_followers_count` and other `public_metrics` sub-fields (easy future adds to the same call).
