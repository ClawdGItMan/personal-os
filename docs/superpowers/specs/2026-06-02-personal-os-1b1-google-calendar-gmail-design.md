# Phase 1B · Slice 1 — Production Deploy + Google (Calendar + Gmail)

> ℹ **2026-06-08 — also surfaces in the native iOS mobile app.** Personal OS is adding a full native
> iOS app (React Native + Swift) as the primary mobile surface. This integration's backend (OAuth
> token store, sync engine, schema, observability) is **client-agnostic and reused unchanged** — the
> native app is a new client. The native-app delta is UI + a mobile OAuth flow, not new backend. See
> `2026-06-08-personal-os-native-mobile-app-design.md`.

**Status:** Design (approved direction; pending reviewed spec + implementation plan)
**Date:** 2026-06-02
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations, §7 Phase 1B)
**Slice owner discipline:** ship this slice fully working end-to-end before starting the next integration (Health Auto Export).

---

## 1. Goal / Outcome

Personal OS runs at a real public URL. Max grants Google access **once** from the Settings page, after which:

- The **Calendar module** renders his actual upcoming Google Calendar events.
- The **Inbox tile** renders his actual important Gmail threads (read-only viewer, not a mail client).
- Both stay fresh automatically via background sync (every few minutes).
- A **reconnect banner** appears if the connection lapses; modules show a `⚠ STALE` chip and fall back to last-known data.
- Manual entry remains available as a fallback path on both modules.

This slice also establishes the **shared connection infrastructure** (encrypted token storage, live Connections UI, failure/stale handling, OAuth callback pattern) that the remaining Phase 1B integrations (Health Auto Export, Whoop, Plaid) will reuse.

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| First integration | Google Calendar + Gmail (bundled) | One OAuth grant covers both `calendar.readonly` + `gmail.readonly`; highest daily-driver value. Matches parent spec order. |
| Hosting / sync engine | **Vercel Pro** ($20/mo), native Vercel Cron | Cleanest single-platform path; lifts other free-tier limits. Max opted to pay rather than wire a free external scheduler. |
| Domain | Free `*.vercel.app` to start | Sufficient for OAuth redirect URIs + webhooks + cron. Custom domain is a later nicety. |
| OAuth app publishing status | Google "Testing" mode, Max as sole test user | Avoids Google's heavy verification for Gmail's *restricted* scope. Tradeoff: refresh tokens lapse ~weekly → periodic Reconnect (handled by the banner). |
| Token storage | Encrypted at rest (pgcrypto), key in Vercel env | Parent spec §6.1 requirement; tokens currently `text` columns with no app-level encryption. |
| Cron auth | Shared `CRON_SECRET` header check on sync routes | Prevents arbitrary external triggering of sync endpoints. |

## 3. Existing landing zone (already shipped in Phase 1A — no schema work needed)

Verified against current migrations:

- **`public.integrations`** (`20260527120001`): `user_id, provider, status ∈ {connected,expired,error}, access_token, refresh_token, last_synced_at, last_error, metadata jsonb`, `unique(user_id, provider)`, full RLS. Tokens are plaintext `text` today — **encryption to be added in this slice**.
- **`public.calendar_events`** (`20260527120004`): `title, sub, location, starts_at, ends_at, all_day, external_id, source ∈ {manual,google_calendar}`, `unique(user_id, source, external_id)` (idempotent provider upserts; manual rows keep `external_id = NULL`), full RLS.
- **`public.gmail_threads`** (`20260527120011`): `gmail_id, sender_name, sender_email, subject, snippet, received_at, is_unread, is_important, labels text[]`, `unique(user_id, gmail_id)`, full RLS.
- **`public.sync_runs`** + **`public.error_events`** (`20260527120012`): per-sync logging + server exception capture.
- Supabase helpers exist: `src/lib/supabase/{server,client,middleware}.ts`.
- Settings Connections UI is a static placeholder: `src/app/(app)/settings/ConnectionsCard.tsx` (already lists Plaid / Google / Whoop / Health Auto Export rows).

**Implication:** this slice is application wiring (OAuth, fetch, upsert, UI state), not migration work — apart from adding token encryption.

## 4. Milestones

### M1 — Production deployment *(DONE — verified live & public 2026-06-03)*

**Production URL:** `https://personal-os-azure-eight.vercel.app` (stable alias — use this for OAuth redirect URIs, cron, and `NEXT_PUBLIC_SITE_URL`; not the per-deploy hash URL). Latest deploy `READY`, commit `0cf8104` (cross-device token-hash magic-link fix). Verified unauthenticated `/` → 307 → `/login` → 200 with no Vercel SSO wall. **Still to confirm with Max:** (a) Vercel **Pro** active (native cron depends on it), (b) one real magic-link sign-in succeeds on the deployed site (also the first step of the pending 1A acceptance).

- Link GitHub repo `ClawdGItMan/personal-os` to a Vercel **Pro** project; auto-deploy on push to `main`.
- Move env vars into Vercel (existing Supabase URL/anon key + new ones from §6).
- Set `NEXT_PUBLIC_SITE_URL` to the `*.vercel.app` URL.
- **Auth landmine (memory: `personal-os-auth-token-hash-flow`):** magic-link sign-in uses the **token-hash** flow. On deploy, update Supabase dashboard **Site URL**, **redirect allow-list**, and the **magic-link email template** to the production URL, or login silently breaks on the deployed site.
- **Double duty:** this deployment is also the environment for the still-pending **Phase 1A hands-on acceptance** (iPhone install → reload → data persists → Lighthouse PWA ≥90).
- **Outputs needed before M3–M5 can be built:** (a) the live production URL, (b) confirmation Vercel Pro is active, (c) confirmation Supabase Site URL/redirects/email template updated.

### M2 — Connection plumbing (shared, built once)
- **Token encryption** at rest via pgcrypto; encryption key from Vercel env. Encrypt on write in the OAuth callback; decrypt server-side only when calling Google. (Decision point for the plan: pgcrypto symmetric helper vs. Supabase Vault — resolve at planning time.)
- **Live Connections card**: replace the static `ConnectionsCard.tsx` with real per-provider state for **Google** — status (connected/expired/error, color-coded sage/honey/rust), last-sync timestamp, and Connect / Reconnect / Disconnect actions (Disconnect confirms first).
- **Reconnect banner** on the dashboard when `integrations.status ∈ {expired,error}` (e.g. `⚠ GOOGLE · RECONNECT`). Either sync job (calendar 5 min / gmail 10 min) flipping `status` on auth failure raises the banner, so detection is bounded by the slower cadence (~10 min) — comfortably inside the §8 15-min gate.
- **Stale chip**: Calendar/Inbox modules show `⚠ STALE · {age}` when `last_synced_at` is older than a threshold, rendering last-known data.
- Reuses `sync_runs` / `error_events` for observability.

### M3 — Google OAuth connect *(requires Max's one-time Google Cloud setup)*
- `GET /api/google/connect` → redirect to Google with scopes `calendar.readonly` + `gmail.readonly`, `access_type=offline`, `prompt=consent` (to reliably get a refresh token).
- `GET /api/google/callback` → exchange code for tokens → encrypt + upsert into `integrations` (provider `google`) → **dispatch** initial backfill to `/api/google/backfill` (async, not inline — see §10) → redirect to `/settings?connected=google`.
- **Max's homework (one-time, ~15 min — provide click-by-click checklist):** create Google Cloud project → enable Calendar API + Gmail API → configure OAuth consent screen in **Testing** mode, add Max as the sole test user → create OAuth **Web** client → set authorized redirect URI to `https://<app>.vercel.app/api/google/callback` → paste client ID/secret into Vercel env.

### M4 — Calendar live
- **Backfill on connect:** next 30 days + past 7 days; `singleEvents=true` to expand recurring instances; upsert by Google event id into `external_id` (`source='google_calendar'`).
- **Cron:** Vercel Cron every 5 min → `GET /api/google-calendar/sync` (CRON_SECRET-guarded) → pull "next 7 days", upsert idempotently; update `integrations.last_synced_at`, log a `sync_runs` row.
- **Gotchas:** all-day events use `date` not `dateTime` → set `all_day=true`, branch the formatter; store UTC, render in `profiles.timezone`.

### M5 — Gmail live
- **Backfill on connect:** last 100 unread + 50 most-recent read from `INBOX`, `category:primary` (skip promotions/social); upsert by `gmail_id`.
- **Cron:** Vercel Cron every 10 min → `GET /api/gmail/sync` (CRON_SECRET-guarded) → pull `labels:INBOX since:max(received_at)-1h`, upsert.
- **Importance:** Gmail's native `IMPORTANT` label drives the "top threads"; fallback = most-recent unread.
- **Note:** read-only viewer. No send/archive/reply in this slice.

## 5. Sync & data-flow architecture

- **Single write path preserved:** integration writes go through the same Zod-validated, RLS-protected server-side path as manual entry, tagged with `source` (`google_calendar` / `gmail`). No bypass.
- **Idempotency:** all provider upserts key on a stable external id (`calendar_events.external_id`, `gmail_threads.gmail_id`) so repeated syncs never duplicate.
- **Freshness signalling:** every successful sync stamps `integrations.last_synced_at`; failures set `status` + `last_error` and append `error_events`. UI derives banner + stale chip from these.
- **Realtime (optional, per parent spec):** Supabase subscription can push new rows to open clients; not required for slice acceptance.

**Route map (explicit — connect/callback and the two sync jobs are deliberately separate; do not collapse):**

| Route | Trigger | Purpose |
|---|---|---|
| `GET /api/google/connect` | User clicks Connect | Redirect to Google consent (both scopes) |
| `GET /api/google/callback` | Google redirect | Token exchange + encrypt + dispatch backfill |
| `POST /api/google/backfill` | Dispatched by callback | Async initial backfill (calendar + gmail) |
| `GET /api/google-calendar/sync` | Vercel Cron (5 min) + CRON_SECRET | Incremental calendar pull |
| `GET /api/gmail/sync` | Vercel Cron (10 min) + CRON_SECRET | Incremental gmail pull |

## 6. New environment variables (set in Vercel + `.env.local`)

| Var | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth app credentials |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<app>.vercel.app/api/google/callback` |
| `TOKEN_ENCRYPTION_KEY` | pgcrypto symmetric key for token encryption |
| `CRON_SECRET` | Shared secret asserted by sync routes |
| `NEXT_PUBLIC_SITE_URL` | Production URL (also fixes auth flow) |

## 7. Security notes

- OAuth tokens encrypted at rest; never logged; decrypted only server-side at call time.
- Sync routes reject requests without the correct `CRON_SECRET`.
- Scopes are **read-only** (`*.readonly`) — no write access to Google data.
- RLS already enforced on all target tables; integration writes still pass `user_id`.
- Disconnect deletes/zeroes stored tokens and flips status.

## 8. Acceptance gate (per parent spec §7 per-slice gate)

> Connect Google via `/settings` → initial backfill completes → at least one fresh cron sync lands new data in `calendar_events` + `gmail_threads` → Calendar module + Inbox tile reflect real data on **web and mobile** → disconnect/reconnect cycle works → revoke the token in Google's security settings and confirm the reconnect banner appears within ~15 min.

Plus: the M1 deployment unblocks the outstanding **Phase 1A acceptance** (iPhone install → reload → persists → Lighthouse PWA ≥90).

## 9. Out of scope (explicitly deferred)

- Health Auto Export, Whoop, Plaid integrations (later Phase 1B slices, one at a time).
- Gmail write actions (send/archive/label), full-text search, attachments.
- Calendar write-back (create/cancel events) — Phase 2 agent territory.
- Custom domain; Supabase Realtime push (optional, not gating).
- Per-device Apple splash screens / service worker (already waived in 1A.6).

## 10. Open items to resolve at planning time

- pgcrypto symmetric encryption helper vs. Supabase Vault for `TOKEN_ENCRYPTION_KEY` management.
- Exact stale-age threshold for the `⚠ STALE` chip.
- Backfill execution: **lean dispatched/async** (separate `/api/google/backfill` route kicked off after the callback) rather than inline — a synchronous 30-day calendar + 150-thread Gmail backfill with per-message fetches risks the Vercel function timeout. Confirm final shape (and whether to split calendar vs. gmail backfill) at planning time.
- `profiles.timezone` wiring (parent spec notes `todayISO()` is currently UTC-based — calendar rendering needs the real tz).
