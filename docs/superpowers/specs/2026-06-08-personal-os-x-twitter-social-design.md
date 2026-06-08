# Phase 1B · Slice — X (Twitter) follower count → Social module

> ℹ **2026-06-08 — also surfaces in the native iOS mobile app.** Personal OS is adding a full native
> iOS app (React Native + Swift) as the primary mobile surface. This integration's backend (OAuth2-
> PKCE, token store, sync, schema) is **client-agnostic and reused unchanged** — the native app is a
> new client. The native-app delta is UI + a mobile OAuth flow, not new backend. See
> `2026-06-08-personal-os-native-mobile-app-design.md`.

**Status:** Design (2026-06-08) — smallest possible integration slice. Auto-populates Max's **X follower count** into the existing Social module. Builds on the **merged** provider-aware OAuth + token-store foundation (Google / Whoop).
**Date:** 2026-06-08
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations)
**Template (mirrored):** `docs/superpowers/specs/2026-06-05-personal-os-strava-design.md`
**Builds on (must be MERGED first):** the provider-aware token store (`getIntegration` / `saveTokens` / `persistRefreshedTokens` / `markStatusFor` / `touchLastSyncedFor` + `buildSaveUpsert` / `buildRefreshUpdate` in `src/lib/integrations/store.ts`), the generalized `ProviderConnectionRow`, the `sync_runs` / `error_events` observability, and the daily/hourly Vercel cron + constant-time `CRON_SECRET` pattern (`src/app/api/whoop/sync/route.ts`).

---

## ⚠️ 0. THE CRUX — current X API access + cost (verified 2026-06-08). READ THIS FIRST. This is the go/no-go.

**Your stale-training-data instinct (the old $100/mo Basic tier) is wrong. The model changed twice in 2026. Here is the current reality.**

### The pricing model flipped to pay-per-use
- **As of 6 Feb 2026, X retired the Free / Basic / Pro subscription tiers for new developers** and replaced them with a **pay-per-use, credit-based** model: you buy credits and are charged per resource. ([X pricing docs](https://docs.x.com/x-api/getting-started/pricing), verified 2026-06-08; corroborated by the [pay-per-use launch coverage](https://superframeworks.com/articles/x-api-pay-per-use-pricing-indie-hackers).)
- The **legacy fixed tiers still exist only for accounts that subscribed before the cutover** — **Basic ≈ $200/mo, Pro ≈ $5,000/mo, Enterprise ≈ $42,000+/mo**. **A new developer (Max) cannot sign up for these.** ([tier comparison](https://postproxy.dev/blog/x-api-pricing-2026/), verified 2026-06-08.) So "just pay $200/mo for Basic" is **not an available option** for a new app.
- There is **no general Free tier for new developers** — free access is granted only case-by-case to "for-good public-utility" apps. ([pricing docs](https://docs.x.com/x-api/getting-started/pricing).)

### Reading your OWN follower count is an "owned read" — and owned reads are dirt cheap
- **Effective 20 Apr 2026, "Owned Reads"** — requests your own developer app makes for **your own data: your posts, bookmarks, followers, likes, lists, and more** — are priced at **$0.001 per resource (1,000 reads for $1).** ([X API pricing-update announcement, 20 Apr 2026](https://devcommunity.x.com/t/x-api-pricing-update-owned-reads-now-0-001-other-changes-effective-april-20-2026/263025); [pricing docs](https://docs.x.com/x-api/getting-started/pricing), both verified 2026-06-08.)
- A **user's follower count lives in `public_metrics.followers_count`** on the User object, fetched with `user.fields=public_metrics`. ([Getting the follower count from Twitter API v2](https://dev.to/xdevs/getting-the-follower-count-from-twitter-api-v2-4jh6).)
- **Cost for this slice:** one owned read per day of `GET /2/users/me?user.fields=public_metrics` ≈ **$0.001/day ≈ $0.03/month** (~$0.36/yr). Even at hourly it's ~$0.72/mo. Owned reads are **deduplicated within a 24h UTC window**, so a daily pull is exactly one billed resource. ([pricing-update announcement](https://devcommunity.x.com/t/x-api-pricing-update-owned-reads-now-0-001-other-changes-effective-april-20-2026/263025).)
- **There is no monthly minimum.** You can set a **per-billing-cycle spending cap** in the Developer Console to hard-stop runaway cost. ([pricing docs](https://docs.x.com/x-api/getting-started/pricing).)

### The catch that decides the auth design: `GET /2/users/me` requires OAuth 2.0 user context (PKCE) — NOT app-only Bearer
- `GET /2/users/me` and the "owned read" $0.001 rate are tied to **OAuth 2.0 Authorization-Code + PKCE (user context)**. **App-only Bearer is rejected on `/2/users/me` with a 403** ("not permitted to use OAuth2 on this endpoint"). ([X dev community: OAuth2 user-context required for /2/users/me](https://devcommunity.x.com/t/oauth-2-0-user-context-requests-endpoints-get-2-users-me-are-forbidden/201780); [app-only auth limits](https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only), verified 2026-06-08.)
- The seemingly-simpler alternative — **app-only Bearer + a configured username** via `GET /2/users/by/username/:username?user.fields=public_metrics` — *would* work with a Bearer token, **but it is a STANDARD read (others' data), billed at the higher "users" rate (~$0.010/resource)** and, more importantly, an app-only Bearer cannot use the cheap owned-read path at all. ([users read pricing](https://docs.x.com/x-api/getting-started/pricing).) At daily cadence the dollar difference is trivial (~$0.30/mo vs ~$0.03/mo), but it forfeits the owned-read rate and still needs a paid credit balance.

### 🔑 Go/no-go verdict
**This integration is viable and effectively free at the margin (~$0.03–$0.36/yr for daily follower count), BUT it requires Max to (a) create an X developer app and (b) load a prepaid credit balance / billing card** — there is no free path for a new developer. The spend is negligible; the **friction is the developer-account + billing setup, not the cost.** Because the cheap owned-read route needs **OAuth 2.0 user-context (PKCE)**, **we recommend the OAuth2-PKCE flow on the existing provider foundation, NOT app-only Bearer** (see §4). **My honest recommendation: do it — the marginal cost is in the pennies-per-year range — but only if Max is willing to do the one-time developer-app + billing setup in §10. If he is not, leave the Social X row on manual entry.**

---

## 1. Goal / Outcome

Max connects **X** once from Settings (the same one-click OAuth flow as Google and Whoop). After that, his **X follower count** auto-populates the existing **Social module** that today he updates by hand — one fresh number per day, tagged `source='api'`. The count lands in the **existing `social_followers` table** (`platform='X'`), kept current by a **daily** background cron. **Zero schema change, zero new UI** — the Social card already renders `platform='X'` rows; this slice just stops Max from typing the number in manually.

This is the **smallest integration in Phase 1B**: one scalar (a follower count), one row per day, one read call. Engagement metrics are explicitly **out of scope** (§9).

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Provider | **X (Twitter)**, OAuth 2.0 **Authorization-Code + PKCE** (user context) | The cheap **owned-read** ($0.001) path for your own follower count is **only** available via OAuth 2.0 user context; app-only Bearer is 403'd on `/2/users/me` (§0). |
| Scope (v1) | **Follower count only**, one number/day | Maps 1:1 onto the existing `social_followers` table. Smallest viable slice. |
| Landing | Existing **`social_followers` table**, `platform='X'`, `source='api'`, upsert on `(user_id, platform, date)` | Table already whitelists `'X'` + `'api'` and is one-row-per-platform-per-day. **No migration.** |
| Surfacing | Existing **Social card** (`SocialCard.tsx`) | Already renders `platform='X'`. The API-written row replaces the manual one for the day. **No new UI.** |
| Sync engine | **Vercel Cron, daily** (`0 7 * * *`, ~07:00 UTC) | A follower count needs only daily freshness; daily = one billed owned read/day (~$0.03/mo). |
| Endpoint | `GET /2/users/me?user.fields=public_metrics` → `public_metrics.followers_count` | The authenticated user's own followers = an **owned read** at $0.001. ([followers in public_metrics](https://dev.to/xdevs/getting-the-follower-count-from-twitter-api-v2-4jh6).) |
| Token handling | **Persist the rotated refresh token on every refresh (write-before-use)** | X OAuth2 refresh tokens are **single-use and rotate** — identical hazard to Whoop. Reuse `persistRefreshedTokens`. ([X OAuth2 docs](https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only).) |
| OAuth scopes | **`tweet.read users.read offline.access`** | `users.read` to read the user object/metrics; `offline.access` to receive a **refresh token** at all (mandatory for unattended daily cron). Read-only. |
| PKCE | **Required** — `code_challenge`/`code_verifier` (S256) | X v2 OAuth2 **mandates PKCE**. This is the one genuinely-new bit vs the Whoop/Google libs (which are plain auth-code). See §4 + §11. |
| Foundation | **Add a provider; minimally extend the OAuth lib for PKCE** | Token store, `ProviderConnectionRow`, cron, observability all reuse as-is. Only the new `src/lib/x/oauth.ts` adds PKCE handling. |

## 3. Landing zones

### 3a. Follower count → existing `social_followers` table (NO migration — verified)

`public.social_followers` (`20260527120008_create_social_followers.sql`): `id`, `user_id`, `platform text CHECK in ('X','LINKEDIN','SUBSTACK','GITHUB','IG')`, `date date`, `count integer`, `source text DEFAULT 'manual' CHECK in ('manual','github','api')`, `created_at`, **`unique (user_id, platform, date)`**, full RLS (own-row CRUD), index `(user_id, platform, date)`.

**`'X'` is already in the `platform` CHECK and `'api'` is already in the `source` CHECK.** This table was provisioned from day one for exactly this. So **no migration at all** — the cron writes into the table as-is. The `integrations.provider` column (`20260527120001_…`) is **free-text (no CHECK)**, so storing the connection as `provider='x'` also needs no migration.

### 3b. Idempotency model — one upsert per day

Each X follower datapoint is owned by exactly one `(user_id, platform='X', date=<today UTC>)`. A blind upsert with `onConflict: 'user_id,platform,date'` is correct and idempotent — re-running the cron the same day overwrites the same row (no duplicates). This **mirrors the existing manual write path** in `src/app/(app)/_actions/social.ts` (`logFollowers` already upserts on `user_id,platform,date`), differing only in `source: 'api'` instead of `'manual'`.

**Manual-vs-API precedence (decide at plan time, recommend default).** Because there is one row per `(platform, date)`, the API write and a same-day manual entry contend for it. **Recommended default: API wins for X** — the whole point is to stop manual entry, so the daily cron upsert silently replaces any manual X figure for that date. (Alternative: only write if no manual row exists that day. Recommend the simpler "API overwrites" — it's a count, not a judgement call.) Recorded as a fork in §11.

### 3c. Field mapping (X response → `social_followers` column)

Source: the User object from `GET /2/users/me?user.fields=public_metrics`. A tiny pure `mapFollowerCount(raw)` extracts one number.

| `social_followers` column | X field | Transform → column | Notes |
|---|---|---|---|
| `count` | `data.public_metrics.followers_count` | integer as-is; **drop the run (no write) if missing/non-numeric** | The only datapoint. Guard against a malformed/absent metrics block — never write a `0`/`NaN` over a good prior value. |
| `platform` | — | constant `'X'` | Already whitelisted. |
| `source` | — | constant `'api'` | Already whitelisted; distinguishes from manual entries. |
| `date` | — | **`todayISO()` in UTC** (reuse `src/lib/format`) | One row/day. Use the same day-key the cron schedule implies (UTC). |
| `user_id` | — | injected by the sync core (admin client), explicit | Service-role path must filter/scope `user_id` explicitly. |

`source_metadata`-style extras (e.g. `tweet_count`, `listed_count`) are **not** stored — `social_followers` has no JSON column and engagement is out of scope (§9).

## 4. Components

All mirror the Whoop/Strava slice shapes. **The only genuinely-new code is `src/lib/x/oauth.ts` (with PKCE), `src/lib/x/client.ts`, the one-line `mapFollowerCount`, `src/lib/sync/x.ts`, and the three routes.** Everything else is reuse.

- **X OAuth lib** (`src/lib/x/oauth.ts`) — mirrors `src/lib/whoop/oauth.ts` but **adds PKCE**. Auth endpoint `https://x.com/i/oauth2/authorize` (alias of `twitter.com/i/oauth2/authorize`), token endpoint `https://api.x.com/2/oauth2/token` (POST, `x-www-form-urlencoded`). `X_SCOPES = ["tweet.read","users.read","offline.access"]` (space-joined). New vs the foundation:
  - `generatePkce()` → `{ verifier, challenge }` (`code_verifier` = high-entropy random; `code_challenge` = base64url(SHA-256(verifier)), `code_challenge_method=S256`). Reuse `node:crypto`.
  - `buildConsentUrl(state, codeChallenge)` with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`.
  - `exchangeCode(code, codeVerifier)` → `{accessToken, refreshToken, expiresAt}` — must send `code_verifier` and authenticate the client. **X uses a confidential client → HTTP Basic auth header (`Authorization: Basic base64(client_id:client_secret)`) on the token request** (confirm at build; some X app types use public-client + `client_id` in body — see §11). Compute `expiresAt = Date.now() + expires_in*1000` (epoch ms, store convention). Throw `XAuthError` if no `refresh_token` (means `offline.access` was dropped).
  - `refreshTokens(refreshToken)` → **`{accessToken, refreshToken, expiresAt}`** — **X rotates the refresh token (single-use); RETURN the new `refresh_token`** (exactly like Whoop; unlike Google). `grant_type=refresh_token`.
  - `XAuthError extends Error` with `status`/`body` (truncate body; never log tokens).
- **X client** (`src/lib/x/client.ts`) — `xFetch(accessToken, path, params)` → JSON, `Authorization: Bearer <user access token>`, throws `XApiError` (with `status`) on non-OK, truncates error body. One method used: `getMe(accessToken)` → `GET /2/users/me?user.fields=public_metrics`. (Mirror Whoop's `client.ts` fetch/error shape. No pagination — single object response.)
- **Follower mapper** (`src/lib/x/social.ts` + `.test.ts`) — pure `mapFollowerCount(raw): number | null` per §3c: returns `data.public_metrics.followers_count` if a finite non-negative integer, else `null` (→ skip write). Unit-tested for the happy path, missing `public_metrics`, and non-numeric guard.
- **X sync core** (`src/lib/sync/x.ts`) — mirror the **single-stream** shape of `src/lib/sync/strava.ts`: `getIntegration(client, userId, "x")`; `readTokens`; **refresh-token guard** (no refresh token → `markStatusFor(..,"expired",..)`); if `metadata.expires_at` (epoch ms) is past/within 60s of `Date.now()`, `refreshTokens` → `persistRefreshedTokens(client, userId, "x", refreshed)` **before** using the new access token (write-before-use; X invalidates the old refresh token immediately); also catch a mid-fetch 401 and refresh-retry once. Call `getMe` → `mapFollowerCount`. If `null` → keep `status='connected'`, record an `error_events` `{ stage: "syncXFollowers" }` + a `partial` `sync_run`, **do not write** (don't clobber a good count with a bad read). Else upsert `{ user_id, platform:'X', date: todayISO(), count, source:'api' }` on `(user_id,platform,date)`. On auth/refresh failure → `markStatusFor("expired")` + failed `sync_run` (raises reconnect banner). Stamp `touchLastSyncedFor(client, userId, "x")`; write `sync_runs` `{ provider:"x", rows_synced: 0|1, status }`. Return `{ ok, status, synced }`. **(`SYNC_PROVIDER = "x"` on `sync_runs`/`error_events`.)**
- **Routes** (`src/app/api/x/{connect,callback,sync}/route.ts`) — mirror the Whoop routes:
  - `GET /api/x/connect` — `getCurrentUserId` guard; `randomBytes(16).toString("hex")` `state`; `generatePkce()`; store **both** `state` AND `verifier` server-side for the callback — set **two short-lived httpOnly cookies `x_oauth_state` and `x_pkce_verifier`** (distinct names so they can't collide with `google_/whoop_/strava_oauth_state`); redirect to `buildConsentUrl(state, challenge)`.
  - `GET /api/x/callback` (`export const maxDuration = 60`) — verify `x_oauth_state`; read `x_pkce_verifier`; `exchangeCode(code, verifier)`; `saveTokens(supabase, userId, "x", tokens, { x_user_id, username })` (store the X user id + handle from the `getMe`/token response in metadata); run `syncX(supabase, userId)` inline (first datapoint immediately); clear both cookies; redirect `/settings?connected=x` / `?error=x` / `?error=x_state`.
  - `GET /api/x/sync` (`export const maxDuration = 60`) — **reuse the existing constant-time `CRON_SECRET` check** (`timingSafeEqual` `authMatches` — copy verbatim from `src/app/api/whoop/sync/route.ts`; do **not** regress to `===`); select `integrations` where `provider='x' AND status='connected'`; call `syncX(admin, row.user_id)` per user in an isolated try/catch (one throw must not abort the batch); count ok/failed; return `{ ok, synced, failed }`.
- **Live X connection row** — render an X row via the **already-generalized `ProviderConnectionRow`** (`provider="x"`, `label="X"`, `sub="SOCIAL"`, `connectPath="/api/x/connect"`, `syncedLabel` via `staleAgeLabel`). **No new component** — add the `x` cases to its disconnect/sync action switch. Leave the Google/Whoop rows untouched.
- **Connections actions** (`src/app/(app)/_actions/connections.ts`) — add `disconnectX()` (delete integration where `provider='x'`, revalidate `/settings` + `/dashboard`) and `syncXNow()` (`syncX(supabase, userId)`, revalidate `/dashboard` + `/settings`), mirroring the Whoop/Strava actions.
- **Social card — REUSED, no change.** `src/components/modules/SocialCard.tsx` already renders `platform='X'` rows; the API row simply appears (and, per §3b default, supersedes the manual one for the day). **Verify-only:** confirm the Social query selects X rows regardless of `source` (so an `source='api'` row shows). If it filtered `source='manual'`, widen it (one line). Optional polish: a small "auto" badge on API-sourced rows — flag as optional, not in acceptance.

## 5. Sync & data-flow architecture

- **Single write path**, source-tagged `api`, **idempotent per `(user_id, platform='X', date)`** via plain upsert. One read → one row/day.
- **Daily cron** (`0 7 * * *`) uses the service-role admin client (no user cookie), explicitly scoped by `user_id`, guarded by the constant-time `CRON_SECRET` check. Add the entry to `vercel.json` alongside the existing `google-calendar` (`*/5`) and `whoop` (`0 * * * *`) crons.
- **Freshness/health** — `integrations.last_synced_at` + `status` drive the existing reconnect banner + stale chip; on auth/refresh failure → `status='expired'`, banner appears within ~1 cycle (≤1 day). A bad/empty read keeps `status='connected'` and records a `partial` `sync_run` only — it never writes a bogus count and never raises the reconnect banner.
- **Cost budget (verified 2026-06-08).** One **owned read**/day = **$0.001/day ≈ $0.03/mo** ([owned-reads pricing](https://devcommunity.x.com/t/x-api-pricing-update-owned-reads-now-0-001-other-changes-effective-april-20-2026/263025)). Owned reads dedupe within a 24h UTC window, so a single daily pull is one billed resource. Set a per-cycle **spending cap** in the Developer Console (e.g. $1/mo) as a hard backstop ([pricing docs](https://docs.x.com/x-api/getting-started/pricing)).
- **Rate limits.** `GET /2/users/me` has a per-user request cap (community reports ~25 req / 24h per user on constrained access) — a **once-daily** pull is comfortably under any cap. ([read-limit discussion](https://devcommunity.x.com/t/understanding-the-read-limit-for-twitter-apis-free-tier/193867).) Confirm the exact cap for the pay-per-use app at build.
- **Token expiry.** X OAuth2 access tokens are short-lived (~2h); with `offline.access` we hold a **rotating, single-use refresh token**. Most daily syncs will refresh first (the access token has expired since yesterday) — so the **rotated-refresh-token write-before-use path runs essentially every day**, making it the highest-risk path (see §8).

## 6. New environment variables

| Var | Purpose |
|---|---|
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X developer-app OAuth 2.0 credentials (from the X Developer Portal). `X_CLIENT_SECRET` only if the app is a **confidential** client (see §11). |
| `X_OAUTH_REDIRECT_URI` | `https://personal-os-azure-eight.vercel.app/api/x/callback` |

Add env getters `getXClientId/Secret/OauthRedirectUri` to `src/lib/env.ts` (mirror the Whoop getters; throw only at call time). Reuses existing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Document in `.env.example`.

> **Note:** unlike the app-only-Bearer idea floated in the brief, there is **no `X_BEARER_TOKEN` and no `X_USERNAME`** — the chosen owned-read path uses per-user OAuth tokens (stored encrypted in `integrations`), so the "connection" is the OAuth grant, not an env-var token. (If §11's fork flips to app-only Bearer, the vars become `X_BEARER_TOKEN` + `X_USERNAME` instead.)

## 7. Security

- **Read-only scopes** (`tweet.read users.read offline.access` — no write/DM scope requested). ([OAuth2 scopes](https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only).)
- **PKCE (S256)** on the authorization-code flow — the `code_verifier` is held in a short-lived httpOnly cookie and exchanged once; protects the redirect even if `state` leaks.
- Tokens **encrypted at rest** (reuse AES-256-GCM `src/lib/crypto/tokens.ts`); **rotated refresh token persisted write-before-use** every refresh cycle (X invalidates the old one immediately — a botched rotation bricks the connection); tokens never logged (truncate error bodies).
- **RLS** enforced on `social_followers` (own-row CRUD). The service-role cron path bypasses RLS, so **the admin-client upsert explicitly sets/filters `user_id`** — never copy the cookie-client (RLS-relying) Social query into the cron path.
- Sync route rejects requests without the correct `CRON_SECRET` (**constant-time** `timingSafeEqual` — reuse, don't regress to `===`).
- **Single write path**, source-tagged `'api'` — the daily cron/backfill is the only thing that writes `source='api'` X rows; manual entries stay `source='manual'`.
- Distinct CSRF/PKCE cookies **`x_oauth_state`** + **`x_pkce_verifier`** (httpOnly, `secure` in prod, short max-age); disconnect deletes the integration row (zeroes encrypted tokens) and the row returns to NOT CONNECTED. (Optional hardening: call X's token-revocation endpoint on disconnect — flag as nice-to-have, not required.)
- **Spending cap** set in the X Developer Console as a financial security control against a runaway loop (§10).

## 8. Acceptance gate

> Connect X via `/settings` → the inline first sync writes today's follower count into `social_followers` (`platform='X'`, `source='api'`) → the **Social card shows the real X follower count** (web + mobile), replacing any manual figure for the day → the **daily cron** updates it the next day → disconnect/reconnect works → revoke the app's access at X (Settings → Connected apps) and confirm the reconnect banner appears within ~1 cycle (≤1 day).
>
> **Refresh-path check (the real risk — runs ~daily here):** let the ~2h access token expire (it will, overnight) and confirm the next daily sync still lands — this exercises the **rotated-refresh-token persist-before-use** path. A botched rotation would permanently brick the connection, and because X access tokens are short-lived this path runs almost every day (unlike Strava's ~6h / every-6th-sync).
>
> **No-clobber check:** confirm a malformed/empty `public_metrics` read does **NOT** write a `0` over a good prior count (it records a `partial` `sync_run` and skips the write), and that an API write only touches the `platform='X'` row (never LINKEDIN/SUBSTACK/GITHUB/IG).
>
> **Mapper unit tests green:** `mapFollowerCount` happy path, missing `public_metrics` → `null`, non-numeric → `null`.

## 9. Out of scope (deferred)

- **Engagement metrics** (likes, impressions, recent-tweet metrics, reply/retweet counts) — **deferred.** Two reasons: (1) **no home table** — `social_followers` stores only a daily count; engagement would need a brand-new table + new UI; (2) reading post/engagement metrics is a **standard read** ($0.005–$0.010/resource) and per-post, far costlier and noisier than the single owned-read follower count. Revisit only if Max wants an engagement view (a separate, larger slice).
- **Other platforms** (LinkedIn, Substack, Instagram, GitHub auto-counts) — separate slices; GitHub already has a `source='github'` path. This slice is X-only.
- **Posting / writes** (`tweet.write`, DMs) — read-only integration; no write scope requested.
- **Follower *list*** (`GET /2/users/:id/followers`) — we want the **count**, not the list of accounts (which is a paginated standard/owned read and pointless for a dashboard number).
- **App-only Bearer + username path** — viable but standard-read-priced and can't use owned reads; recorded as the §11 fork, not the default.
- **`verified_followers_count`** and other `public_metrics` sub-fields — capture only `followers_count` for v1; the rest are easy future adds to the same call if a richer Social card ever wants them.

## 10. Max's one-time setup (~15–20 min — click-by-click)

> **Lead time: immediate, but requires a billing card.** Creating an X developer app is self-service, but the **pay-per-use model requires a payment method / prepaid credit balance before any read succeeds** — there is **no free path for a new developer** (§0). Budget ~15–20 min. **Cost to expect: pennies per year** (~$0.03/mo at daily cadence), but a card on file is mandatory.

1. Sign in to X, go to the **X Developer Portal** (developer.x.com) → create a developer account if you don't have one (agree to the developer terms).
2. **Add billing / buy credits.** In the Developer Portal billing section, add a payment method and (if required) purchase a small starter credit balance. **Set a per-billing-cycle spending cap** (e.g. **$1/month**) as a hard backstop — this slice will only ever spend cents.
3. **Create a Project + App** (a Project is required to use API v2).
4. In the App's **User authentication settings**, enable **OAuth 2.0**:
   - **Type of App:** choose **Web App / Confidential client** (gives a Client Secret; if you pick a public client there's no secret — see §11 fork).
   - **App permissions:** **Read** (we only read).
   - **Callback URI / Redirect URL:** add **`https://personal-os-azure-eight.vercel.app/api/x/callback`** (and, for local dev, **`http://localhost:3000/api/x/callback`** — X allows multiple callback URLs, so register both; no domain-only restriction like Strava).
   - **Website URL:** `https://personal-os-azure-eight.vercel.app`.
5. Save. Copy the **Client ID** and (for a confidential app) the **Client Secret** from the **Keys and tokens** tab.
6. Set in Vercel (Production) **and** `.env.local`:
   - `X_CLIENT_ID` = the OAuth 2.0 Client ID
   - `X_CLIENT_SECRET` = the OAuth 2.0 Client Secret (omit if public client)
   - `X_OAUTH_REDIRECT_URI` = `https://personal-os-azure-eight.vercel.app/api/x/callback` (use the localhost value in `.env.local`)
   - Reuse the already-set `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
7. **Redeploy.** Then connect from `/settings`. Scopes (`tweet.read users.read offline.access`) are requested by our app on the consent screen, not configured in the portal.

## 11. Open items / forks (recommend the default; Max decides — do NOT block)

- **API spend / billing (the big one).** X retired tiers for new devs → **pay-per-use, owned reads $0.001/resource, no free path**. Daily follower count ≈ **$0.03/mo (~$0.36/yr)**. **Recommendation: proceed — the marginal cost is pennies/year — provided Max does the one-time developer-app + billing-card setup (§10) and sets a $1/mo spending cap.** Honest take: worth it *if* Max wants the number auto-filled and is OK putting a card on X's developer billing; if either is a no, keep the Social X row on manual entry. **(Verified 2026-06-08 — re-check pricing at build; X has changed it repeatedly.)**
- **Auth: OAuth2-PKCE (user context) vs app-only Bearer + username.** **Recommend OAuth2-PKCE (the default in this spec)** — it's the only route to the cheap owned read and matches the existing Google/Whoop foundation. App-only Bearer + `X_USERNAME` is simpler to wire (no consent flow) **but** is rejected on `/2/users/me`, forces the standard `by/username` read (~$0.010, ~10× the owned-read rate, still trivial in absolute terms), and still needs a billing balance — so it trades a marginally simpler connect flow for a worse cost path and no real setup savings. Only flip to app-only if the PKCE wiring proves troublesome at build.
- **Confidential vs public OAuth client.** X offers both. **Recommend confidential (Web App + Client Secret + HTTP Basic on token requests)** — server-side, matches the Whoop/Google pattern. If Max's app is created as a public client, drop `X_CLIENT_SECRET` and send `client_id` in the token-request body instead. Confirm the app type at build and wire the token-request auth accordingly.
- **Follower-count-only vs also engagement.** **Recommend count-only for v1** (it's the only thing the `social_followers` table can hold without a migration; engagement is a standard read and needs new schema + UI). Engagement = a separate future slice (§9).
- **Sync cadence.** **Recommend daily (`0 7 * * *`)** — a follower count doesn't need sub-day freshness, and daily = one billed owned read/day. Hourly would still cost only ~$0.72/mo but is pointless for this metric.
- **Manual-vs-API precedence on the shared daily row.** **Recommend "API overwrites"** (the cron silently replaces any manual X figure for the day — the goal is to stop manual entry). Alternative: skip the write if a manual row exists. It's a count, not a judgement call → overwrite.
- **Is it even worth it?** **My honest recommendation: yes, marginally — but it's the lowest-leverage of the 1B integrations.** It removes a tiny recurring manual chore (typing one number) for ~pennies/year, and proves the foundation generalizes to a social-metrics provider. The only real cost is the §10 setup friction + putting a card on X developer billing. If Max is mid-runway and guarding focus, this is a fine "later/nice-to-have" — not a must-ship. Defer without guilt if bigger threads are open.
- **Confirm exact X field/endpoint details at build** — `GET /2/users/me?user.fields=public_metrics` returning `public_metrics.followers_count`, the token-endpoint host (`api.x.com/2/oauth2/token`), the `users.read` scope name, and the per-user rate cap were all verified against current sources 2026-06-08, but re-confirm the exact JSON keys + auth header when wiring `src/lib/x/oauth.ts` and `client.ts`.

---

### Live-doc verification log (checked 2026-06-08)
- X API pricing (pay-per-use model, owned reads, spending cap, no free tier) — https://docs.x.com/x-api/getting-started/pricing
- Owned-reads $0.001 pricing update (effective 20 Apr 2026) — https://devcommunity.x.com/t/x-api-pricing-update-owned-reads-now-0-001-other-changes-effective-april-20-2026/263025
- Pay-per-use launch / legacy tier ($200 Basic / $5k Pro / $42k+ Enterprise) context — https://postproxy.dev/blog/x-api-pricing-2026/ ; https://superframeworks.com/articles/x-api-pay-per-use-pricing-indie-hackers
- `/2/users/me` requires OAuth 2.0 user context (app-only Bearer 403'd) — https://devcommunity.x.com/t/oauth-2-0-user-context-requests-endpoints-get-2-users-me-are-forbidden/201780
- App-only authentication limits — https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only
- Follower count lives in `public_metrics` — https://dev.to/xdevs/getting-the-follower-count-from-twitter-api-v2-4jh6
- Get-followers endpoint reference (auth + `user.fields`) — https://docs.x.com/x-api/users/get-followers
- `/2/users/me` read-limit discussion — https://devcommunity.x.com/t/understanding-the-read-limit-for-twitter-apis-free-tier/193867
