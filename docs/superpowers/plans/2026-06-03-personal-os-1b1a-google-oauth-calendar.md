# Personal OS 1B.1a — Foundation + Google OAuth + Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before writing ANY Google/Vitest/Vercel code, open the linked official docs and verify current signatures.** Training data for these APIs is unreliable. Doc links are in each task.

**Goal:** Max connects his Google account once from Settings, and the dashboard Calendar module shows his real upcoming events, kept fresh by a 5-minute Vercel Cron — with encrypted token storage, a live Connections card, and reconnect/stale handling.

**Architecture:** A reusable connection layer (AES-256-GCM token encryption with the key in Vercel env; an `integrations` data-access store; a service-role Supabase client for cron) sits under a Google OAuth flow (`/api/google/connect` → Google consent → `/api/google/callback`). Calendar sync logic (`src/lib/sync/calendar.ts`) is shared by both the initial backfill (run inline in the callback) and the 5-min cron route. The Calendar dashboard module becomes a server-component data loader; a dashboard banner + stale chip surface connection health.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19 server components, Supabase (`@supabase/ssr` cookie client + `@supabase/supabase-js` service-role client), Node `crypto` (AES-256-GCM, no new runtime deps), Zod, Vitest (new dev dep), Playwright, Vercel Cron (Pro).

**Parent spec:** `docs/superpowers/specs/2026-06-02-personal-os-1b1-google-calendar-gmail-design.md`

---

## Pre-flight — Max's one-time setup (BLOCKS Tasks 5–6, 9–12; everything else can start without it)

These create the credentials only the human operator can create. The executor should surface this checklist to Max and confirm the env vars exist in Vercel **before** running OAuth/sync tasks. Tasks 0–4, 7 (UI scaffold) can proceed in parallel without them.

**A. Google Cloud project + OAuth app** (docs: https://developers.google.com/identity/protocols/oauth2/web-server , consent screen: https://support.google.com/cloud/answer/10311615)
1. Create a Google Cloud project (e.g. "Personal OS").
2. **APIs & Services → Library →** enable **Google Calendar API** (Gmail API is enabled in 1B.1b).
3. **OAuth consent screen →** User type **External**, publishing status **Testing**. Add `max.allaire@gmail.com` as a **Test user**. (Testing mode = refresh tokens expire ~7 days → periodic Reconnect; accepted tradeoff, handled by the banner. `calendar.readonly` is a *sensitive* scope; staying in Testing avoids verification.)
4. Add scope `https://www.googleapis.com/auth/calendar.readonly`.
5. **Credentials → Create credentials → OAuth client ID →** Application type **Web application**. Authorized redirect URI: **`https://personal-os-azure-eight.vercel.app/api/google/callback`** (and `http://localhost:3000/api/google/callback` for local dev). Copy the **Client ID** and **Client secret**.

**B. Generate secrets** (run locally):
- `openssl rand -base64 32` → `TOKEN_ENCRYPTION_KEY`
- `openssl rand -hex 32` → `CRON_SECRET`

**C. Supabase service-role key:** Supabase dashboard → Project Settings → API → copy **`service_role`** key (secret). This is for cron (no user cookie). NEVER expose to the client.

**D. Set env vars** — in **Vercel** (Project → Settings → Environment Variables, Production + Preview + Development) AND in local `.env.local`:

| Var | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from A5 |
| `GOOGLE_CLIENT_SECRET` | from A5 |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://personal-os-azure-eight.vercel.app/api/google/callback` (use the localhost one in `.env.local`) |
| `TOKEN_ENCRYPTION_KEY` | from B |
| `CRON_SECRET` | from B |
| `SUPABASE_SERVICE_ROLE_KEY` | from C |
| `NEXT_PUBLIC_SITE_URL` | `https://personal-os-azure-eight.vercel.app` (prod) / `http://localhost:3000` (local) |

After setting Vercel env vars, redeploy so they take effect.

**E. Confirm before OAuth tasks:** (1) Vercel **Pro** is active (cron depends on it), (2) one real magic-link sign-in works on the deployed site (also closes pending 1A acceptance).

---

## File structure

**Create:**
- `vitest.config.ts` — Vitest config (node env, path alias `@`)
- `src/lib/crypto/tokens.ts` — `encryptToken` / `decryptToken` (AES-256-GCM)
- `src/lib/crypto/tokens.test.ts`
- `src/lib/env.ts` — typed server-env accessor (throws if missing)
- `src/lib/supabase/admin.ts` — service-role client (server-only, cron)
- `src/lib/integrations/store.ts` — integration row read/write + token (de)cryption
- `src/lib/google/oauth.ts` — consent URL, code exchange, token refresh
- `src/lib/google/calendar.ts` — Calendar REST fetch + `mapEvent` row mapper
- `src/lib/google/calendar.test.ts`
- `src/lib/sync/calendar.ts` — `syncCalendar` (backfill/incremental window, upsert, status, logging)
- `src/lib/sync/stale.ts` — `isStale` + `staleAgeLabel`
- `src/lib/sync/stale.test.ts`
- `src/app/api/google/connect/route.ts`
- `src/app/api/google/callback/route.ts`
- `src/app/api/google-calendar/sync/route.ts`
- `src/app/(app)/settings/_actions/connections.ts` — `disconnectGoogle`, `syncGoogleNow`
- `src/app/(app)/settings/GoogleConnectionRow.tsx` — client row (Connect/Reconnect/Disconnect + post-connect sync trigger)
- `src/components/modules/calendar/CalendarList.tsx` — renders event rows
- `src/components/primitives/ConnectionBanner.tsx` — dashboard reconnect banner
- `vercel.json` — cron entry
- `tests/e2e/connections.spec.ts` — Playwright

**Modify:**
- `package.json` — add `vitest`, `@vitest/coverage-v8` (dev), `test` script
- `.env.example` — document new vars (names only)
- `src/app/(app)/settings/ConnectionsCard.tsx` — load Google integration status, render live row
- `src/components/modules/CalendarCard.tsx` — load + render real events + stale chip
- `src/app/(app)/dashboard/page.tsx` — render `<ConnectionBanner />`

**No migrations** — `integrations` / `calendar_events` already match (verified). Tokens reuse the existing `access_token` / `refresh_token` text columns, now storing ciphertext.

---

## Task 0: Vitest setup

**Files:** Create `vitest.config.ts`; Modify `package.json`.
**Docs:** https://vitest.dev/guide/ , https://nextjs.org/docs/app/guides/testing/vitest

- [ ] **Step 1: Install** — `pnpm add -D vitest @vitest/coverage-v8`
- [ ] **Step 2: Config** — create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 3: Script** — add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 4: Smoke test** — create `src/lib/crypto/tokens.test.ts` with a `it("vitest runs", () => expect(1).toBe(1))` placeholder; run `pnpm test`; expect 1 passing.
- [ ] **Step 5: Commit** — `chore: add vitest unit-test runner (1B.1a)`

## Task 1: Token encryption (AES-256-GCM) — TDD

**Files:** Create `src/lib/crypto/tokens.ts`; Test `src/lib/crypto/tokens.test.ts`.
**Why app-level (not pgcrypto):** key stays in Vercel env, DB only stores ciphertext. Format: `base64(iv).base64(ciphertext).base64(authTag)`, AES-256-GCM, 12-byte IV. Key = base64-decoded `TOKEN_ENCRYPTION_KEY` (must be 32 bytes).

- [ ] **Step 1: Failing tests** — replace the smoke test:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "./tokens";

beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("token encryption", () => {
  it("round-trips a value", () => {
    const secret = "ya29.some-google-access-token";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });
  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });
  it("throws on tampered ciphertext", () => {
    const enc = encryptToken("x");
    const tampered = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
    expect(() => decryptToken(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm test` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/lib/crypto/tokens.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be base64 of 32 bytes");
  return k;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ct, tag].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(payload: string): string {
  const [ivB64, ctB64, tagB64] = payload.split(".");
  if (!ivB64 || !ctB64 || !tagB64) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Run → pass** — `pnpm test` → 3 passing.
- [ ] **Step 5: Commit** — `feat: AES-256-GCM token encryption helper (1B.1a)`

## Task 2: Env accessor + service-role admin client

**Files:** Create `src/lib/env.ts`, `src/lib/supabase/admin.ts`.
**Docs:** https://supabase.com/docs/reference/javascript/initializing (service role: never in client; bypasses RLS).

- [ ] **Step 1:** `src/lib/env.ts` — a `requireEnv(name)` helper that throws a clear error if unset, plus named getters for `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] **Step 2:** `src/lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { requireEnv } from "@/lib/env";

/** Service-role client for trusted server contexts (cron) with no user cookie. Bypasses RLS — always scope queries by user_id explicitly. */
export function createAdminClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 3:** Add `server-only` dep if not present (`pnpm add server-only`) — guards against accidental client import.
- [ ] **Step 4: Verify** — `pnpm tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat: typed env accessor + service-role supabase client (1B.1a)`

## Task 3: Integrations store

**Files:** Create `src/lib/integrations/store.ts`.
Accepts a Supabase client (either cookie or admin) so both user and cron paths reuse it. Functions: `getGoogleIntegration(client, userId)`, `saveGoogleTokens(client, userId, {accessToken, refreshToken, expiresAt})` (encrypts both, status `connected`, `metadata.expires_at`), `readTokens(row)` → `{accessToken, refreshToken}` (decrypts), `markStatus(client, userId, status, lastError?)`, `touchLastSynced(client, userId)`. Provider literal `"google"`. Upsert on conflict `(user_id, provider)`.

- [ ] **Step 1:** Implement the store (mirror the insert/update shape in `src/app/(app)/_actions/finance.ts`; use `decryptToken`/`encryptToken` from Task 1).
- [ ] **Step 2:** Unit test `src/lib/integrations/store.test.ts` for `readTokens` against a fake row with encrypted values (encrypt in the test, assert decrypt). DB-touching fns are covered by Playwright/manual later.
- [ ] **Step 3: Run → pass**; `pnpm tsc --noEmit` clean.
- [ ] **Step 4: Commit** — `feat: integrations token store (encrypted) (1B.1a)`

## Task 4: Google OAuth library

**Files:** Create `src/lib/google/oauth.ts`.
**Docs (READ FIRST — verify endpoints/params):** https://developers.google.com/identity/protocols/oauth2/web-server#httprest
Endpoints (stable): auth `https://accounts.google.com/o/oauth2/v2/auth`; token `https://oauth2.googleapis.com/token`.

- [ ] **Step 1:** Implement:
  - `GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]` (Gmail scope appended in 1B.1b).
  - `buildConsentUrl(state: string)` — query params: `client_id`, `redirect_uri`, `response_type=code`, `scope` (space-joined), `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, `state`.
  - `exchangeCode(code)` → POST token endpoint (`application/x-www-form-urlencoded`): `code, client_id, client_secret, redirect_uri, grant_type=authorization_code`. Return `{ accessToken, refreshToken, expiresAt }` (`expiresAt = Date.now() + expires_in*1000`).
  - `refreshAccessToken(refreshToken)` → POST: `refresh_token, client_id, client_secret, grant_type=refresh_token`. Return `{ accessToken, expiresAt }`. Throw a typed `GoogleAuthError` on non-200 (callers map to `expired`).
- [ ] **Step 2: Verify** — `pnpm tsc --noEmit` clean. (No unit test — thin HTTP wrapper; covered by manual OAuth at acceptance.)
- [ ] **Step 3: Commit** — `feat: google oauth lib (consent/exchange/refresh) (1B.1a)`

## Task 5: `/api/google/connect` route  *(needs pre-flight A/D)*

**Files:** Create `src/app/api/google/connect/route.ts`.
Generates a random `state`, stores it in a short-lived httpOnly cookie (CSRF), redirects to `buildConsentUrl(state)`.

- [ ] **Step 1:** Implement GET: require signed-in user (`getCurrentUserId`; else redirect `/login`); `state = randomBytes(16).toString("hex")`; set cookie `google_oauth_state` (httpOnly, secure, sameSite lax, maxAge 600); `return NextResponse.redirect(buildConsentUrl(state))`.
- [ ] **Step 2: Verify** — `pnpm tsc --noEmit`; build (`pnpm build`) compiles the route.
- [ ] **Step 3: Commit** — `feat: google connect route (1B.1a)`

## Task 6: `/api/google/callback` route + inline calendar backfill  *(needs pre-flight + Task 9)*

**Files:** Create `src/app/api/google/callback/route.ts`. `export const maxDuration = 60;`
Flow: validate `state` vs cookie (reject mismatch → `/settings?error=google_state`); require signed-in user; `exchangeCode(code)`; `saveGoogleTokens(...)`; **run `syncCalendar` once inline** (initial backfill — light: one paginated GET over a 37-day window); redirect `/settings?connected=google`. Wrap in try/catch → on failure `markStatus("error")` + redirect `/settings?error=google`.

> Backfill decision (resolves spec §10 item 3): Calendar backfill is small enough to run **inline in the callback** under `maxDuration=60`. No separate `/api/google/backfill` route. Gmail's heavier backfill is handled in 1B.1b.

- [ ] **Step 1:** Implement per flow above (depends on `syncCalendar` from Task 9 — order Task 9 before 6, or stub then wire).
- [ ] **Step 2: Verify** — `pnpm tsc --noEmit`; `pnpm build`.
- [ ] **Step 3: Commit** — `feat: google callback + inline calendar backfill (1B.1a)`

## Task 7: Live Connections card + disconnect  *(no pre-flight needed for scaffold)*

**Files:** Modify `src/app/(app)/settings/ConnectionsCard.tsx`; Create `src/app/(app)/settings/GoogleConnectionRow.tsx`, `src/app/(app)/settings/_actions/connections.ts`.
Make `ConnectionsCard` an async server component: load `getGoogleIntegration(cookieClient, userId)`; render the Google row via `GoogleConnectionRow` (status colour sage/honey/rust, last-sync label, `Connect` = link to `/api/google/connect`, or `Reconnect` (same link) + `Disconnect`). Keep Plaid/Whoop/Health rows as `NOT CONNECTED` placeholders. `disconnectGoogle()` server action deletes the integration row (and zeroes tokens) after confirm; `revalidatePath("/settings")`.

- [ ] **Step 1:** Implement action(s) + row + card (follow `ActionResult` + `revalidatePath` pattern; confirm-before-disconnect like the spec).
- [ ] **Step 2:** `syncGoogleNow()` action — used by the post-connect "Syncing…" trigger: `getCurrentUserId` → `syncCalendar(cookieClient, userId)` → `revalidatePath("/dashboard")`. `GoogleConnectionRow` calls it on mount when URL has `?connected=google`.
- [ ] **Step 3: Verify** — `pnpm tsc --noEmit`; `pnpm lint`; `pnpm build`.
- [ ] **Step 4: Commit** — `feat: live google connections card + disconnect (1B.1a)`

## Task 8: Calendar fetch + `mapEvent` mapper — TDD

**Files:** Create `src/lib/google/calendar.ts`; Test `src/lib/google/calendar.test.ts`.
**Docs (READ FIRST):** https://developers.google.com/calendar/api/v3/reference/events/list (params: `singleEvents=true`, `orderBy=startTime`, `timeMin`, `timeMax`, `maxResults`, `pageToken`).

- [ ] **Step 1: Failing tests for `mapEvent`** (the contract):

```ts
import { describe, it, expect } from "vitest";
import { mapEvent } from "./calendar";

describe("mapEvent", () => {
  it("maps a timed event", () => {
    const row = mapEvent({ id: "abc", summary: "Standup", location: "Zoom",
      start: { dateTime: "2026-06-04T15:00:00Z" }, end: { dateTime: "2026-06-04T15:30:00Z" }, status: "confirmed" });
    expect(row).toMatchObject({ external_id: "abc", title: "Standup", location: "Zoom",
      all_day: false, source: "google_calendar", starts_at: "2026-06-04T15:00:00Z" });
  });
  it("flags all-day events (date, not dateTime)", () => {
    const row = mapEvent({ id: "d1", summary: "Trip", start: { date: "2026-06-10" }, end: { date: "2026-06-11" }, status: "confirmed" });
    expect(row.all_day).toBe(true);
    expect(row.starts_at.startsWith("2026-06-10")).toBe(true);
  });
  it("defaults a missing title", () => {
    expect(mapEvent({ id: "x", start: { dateTime: "2026-06-04T15:00:00Z" }, status: "confirmed" }).title).toBe("(no title)");
  });
  it("returns null for cancelled events", () => {
    expect(mapEvent({ id: "x", status: "cancelled", start: {} })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `mapEvent` to satisfy tests + `fetchEvents(accessToken, { timeMin, timeMax })` (paginated GET to events.list, returns raw items). All-day `date` → store as `YYYY-MM-DDT00:00:00Z`.
- [ ] **Step 4: Run → pass**; `pnpm tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat: calendar fetch + event mapper (1B.1a)`

## Task 9: Calendar sync core

**Files:** Create `src/lib/sync/calendar.ts`.
`syncCalendar(client, userId)`: load integration; `readTokens`; window = `last_synced_at ? { timeMin: now, timeMax: now+7d } : { timeMin: now-7d, timeMax: now+30d }`; `fetchEvents` (on 401 → `refreshAccessToken`, persist new access token, retry once; if refresh throws → `markStatus("expired", msg)` + write a `sync_runs` `{ user_id, provider: "google_calendar", started_at, finished_at, rows_synced: 0, status: "failed", error_message }` + return); `mapEvent` each (drop nulls); upsert into `calendar_events` `onConflict: "user_id,source,external_id"`; `touchLastSynced`; insert `sync_runs` `{ user_id, provider: "google_calendar", started_at, finished_at, rows_synced, status: "ok" }`; on any thrown error insert `error_events` `{ user_id, provider: "google_calendar", severity: "error", message, context }` + `markStatus("error", message)`.

> **Both `sync_runs` and `error_events` have `user_id NOT NULL`** — always include it (it's in scope as `userId`). `sync_runs.status ∈ {ok,partial,failed}`; `error_events.severity ∈ {info,warn,error}`. Confirm exact columns against `supabase/migrations/20260527120012_create_observability.sql`.

- [ ] **Step 1:** Implement (use the passed client; do not create its own — caller supplies cookie or admin client).
- [ ] **Step 2: Verify** — `pnpm tsc --noEmit`. (DB behaviour validated at acceptance; logic is thin orchestration over tested pieces.)
- [ ] **Step 3: Commit** — `feat: calendar sync core (backfill+incremental, refresh, logging) (1B.1a)`

## Task 10: Cron sync route + `vercel.json`  *(needs pre-flight)*

**Files:** Create `src/app/api/google-calendar/sync/route.ts` (`export const maxDuration = 60;`), `vercel.json`.
**Docs (READ FIRST):** https://vercel.com/docs/cron-jobs , https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs (Vercel sends `Authorization: Bearer $CRON_SECRET`).

- [ ] **Step 1:** Route GET: assert `req.headers.get("authorization") === \`Bearer ${requireEnv("CRON_SECRET")}\``, else `401`. Use `createAdminClient()`; select all `integrations` where `provider="google"`; `syncCalendar(admin, row.user_id)` for each; return `{ ok, synced }`.
- [ ] **Step 2:** `vercel.json`:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [ { "path": "/api/google-calendar/sync", "schedule": "*/5 * * * *" } ] }
```

- [ ] **Step 3: Verify** — `pnpm build` (Vercel reads `vercel.json` crons at deploy); `pnpm tsc --noEmit`.
- [ ] **Step 4: Commit** — `feat: calendar cron sync route + vercel.json (1B.1a)`

## Task 11: Calendar module renders real data + stale chip

**Files:** Modify `src/components/modules/CalendarCard.tsx`; Create `src/components/modules/calendar/CalendarList.tsx`, `src/lib/sync/stale.ts` (+ `stale.test.ts`).
**Note:** render times in `profiles.timezone` (exists, default `'UTC'`) via `Intl.DateTimeFormat(undefined, { timeZone, ... })`.

- [ ] **Step 1: TDD `isStale`** — `isStale(lastSyncedAt: string | null, thresholdMin = 30)` → true if null or older than threshold; `staleAgeLabel(lastSyncedAt)` → e.g. `"4h"`. Tests cover null, fresh, stale.
- [ ] **Step 2:** `CalendarCard` (async server component): load next ~7 days from `calendar_events` (`order starts_at`); load Google integration for status/last_synced; render `CalendarList` (or `EmptyState` "No events" when empty); show `⚠ STALE · {age}` chip when `isStale`.
- [ ] **Step 3: Verify** — `pnpm test`; `pnpm tsc --noEmit`; `pnpm lint`; `pnpm build`.
- [ ] **Step 4: Commit** — `feat: calendar module renders real events + stale chip (1B.1a)`

## Task 12: Dashboard reconnect banner

**Files:** Create `src/components/primitives/ConnectionBanner.tsx`; Modify `src/app/(app)/dashboard/page.tsx`.
Banner (server component): query `integrations` for any row with `status ∈ {expired,error}`; if found render `⚠ GOOGLE · RECONNECT` linking to `/settings`; else render nothing.

- [ ] **Step 1:** Implement banner + add `<ConnectionBanner />` at top of dashboard.
- [ ] **Step 2: Verify** — `pnpm tsc --noEmit`; `pnpm lint`; `pnpm build`.
- [ ] **Step 3: Commit** — `feat: dashboard reconnect banner (1B.1a)`

## Task 13: Playwright + full verification gate

**Files:** Create `tests/e2e/connections.spec.ts`.
**Reminder (from project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

> **Repo convention:** existing e2e specs are **unauthenticated** (the project treats the authenticated render as "Max's manual seam" — see `tests/e2e/secondary-pages.spec.ts`). There is **no Playwright auth/session fixture**, and building one is out of scope here. Keep Task 13 e2e unauthenticated; the authenticated Connect→consent flow is covered by the **manual acceptance gate** below, not CI.

- [ ] **Step 1:** Playwright (**unauthenticated**, mirroring the existing specs): assert a signed-out visit to `/api/google/connect` redirects to **`/login`** (per Task 5, signed-out users are bounced to login — this verifies the route exists and guards itself without needing a session or hitting Google). Optionally assert `/settings` while signed-out redirects to `/login`. Do NOT attempt real Google login or build an auth fixture in CI.
- [ ] **Step 2: Run full gate:**
  - `pnpm test` → all unit pass
  - `pnpm tsc --noEmit` → 0 errors
  - `pnpm lint` → 0 errors
  - `pnpm build` → succeeds
  - `pnpm test:e2e` → green
- [ ] **Step 3: Commit** — `test: e2e connections + green full gate (1B.1a)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After deploy with all env vars set:
1. Sign in → **Settings → Connections →** click **Connect** on Google → Google consent → approve.
2. Redirected back to Settings showing **Google · CONNECTED · synced just now**.
3. **Dashboard → Calendar module** shows your real upcoming events (web **and** mobile).
4. Wait ≤5 min (or push a new event in Google) → it appears after the next cron sync.
5. **Disconnect** → confirm → row returns to NOT CONNECTED; reconnect works.
6. In Google Account → Security → revoke "Personal OS" access → within ~10 min the dashboard shows `⚠ GOOGLE · RECONNECT`.

Passing = 1B.1a done. Next plan: **1B.1b (Gmail)** reuses this foundation (OAuth adds `gmail.readonly`, new sync core + Inbox module, 10-min cron).

## Notes / deviations from spec
- **Encryption:** app-level AES-256-GCM (key in Vercel env) instead of pgcrypto — same "encrypted at rest" intent, key kept out of the DB. (Spec §6.1 / §10.)
- **Backfill:** run inline in the OAuth callback (`maxDuration=60`) rather than a separate dispatched route — calendar backfill is light. (Resolves spec §10 item 3 for calendar; Gmail handled separately in 1B.1b.)
- **Cron auth:** Vercel's built-in `Authorization: Bearer $CRON_SECRET`.
- **Slice split:** Gmail deferred to 1B.1b so each plan ships a visible outcome.
