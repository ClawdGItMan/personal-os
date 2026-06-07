# Phase 1B · Slice — Plaid (Finance: Balances + Transactions)

**Status:** Design (drafted 2026-06-05; pending reviewed spec + plan)
**Date:** 2026-06-05
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations)
**Builds on:** the connection foundation generalized by the Whoop slice (1B.2) — the **provider-aware encrypted token store** (`src/lib/integrations/store.ts`), the **sync observability** (`sync_runs` / `error_events`), the **Vercel cron** pattern, the generalized **`ProviderConnectionRow`**, and `src/lib/supabase/admin.ts`. Plaid's connection flow is **Link, not an OAuth redirect**, so it adapts these patterns rather than cloning them.
**Template:** This spec mirrors the section structure of `docs/superpowers/specs/2026-06-05-personal-os-whoop-health-design.md`.

> **Build last, pre-flight first.** Plaid is the largest new-surface integration and the most independent domain (money), so it is **built last** in the roadmap (Strava → Apple Health → Plaid). **But its real-world pre-flight has the longest lead time and must start FIRST** — see §10. Production access is a human-gated application (~a few business days to ~1 week). Sandbox is immediate, so **the entire slice can be built and demoed against Sandbox while production approval is in flight.**

---

## 1. Goal / Outcome

Max connects a bank/brokerage **once** from Settings via the **Plaid Link** widget (a hosted bank-login modal, not a redirect-and-return like Google/Whoop). After that:

- His **account balances update automatically** — Plaid-linked accounts appear in the existing Finance **Accounts** list and feed the **net-worth total + 30-day sparkline**, alongside (never clobbering) the **manually-entered accounts** from Plan 1A.4.
- His **categorized transaction history** lands in a new **`transactions` table** and renders as a **Transactions section on the Finance page** (date, merchant, amount, category, pending flag).
- Everything stays fresh via **Plaid webhooks** (`SYNC_UPDATES_AVAILABLE`) with an **hourly cron fallback**, using the cursor-based `/transactions/sync` engine and the existing `sync_runs` / `error_events` observability.

This is **balances + transactions ingestion + display only** — no budgeting, forecasting, categorization-editing, or spend analytics (YAGNI). It is the finance counterpart to the Whoop health slice.

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Scope (v1) | **Balances + transactions together** (full finance slice) | One Link connection unlocks both; `/transactions/sync` returns balances in the same call, so splitting them would be artificial. |
| Provider/auth | **Plaid Link** → `public_token` → server exchange → durable item `access_token` | Plaid is **not** OAuth-redirect; it's a client-side widget. The `access_token` **does not expire and does not rotate** (verified) — so there is **no refresh-token machinery** (the opposite of Whoop). |
| Balances landing | **Update the EXISTING `finance_accounts` table** (source-tagged `plaid`) | The 1A.4 table was pre-wired for this: it already has `plaid_account_id text` and `source ∈ {manual,plaid,coinbase}`. Plaid rows coexist with manual rows; net worth sums both. |
| Transactions landing | **NEW `transactions` table**, lightly **provider-agnostic** (source-tagged) | Mirrors the Whoop `workouts` philosophy — a shared finance-transactions landing zone (later Coinbase could feed it), not a Plaid-only table. |
| Item store | **NEW `plaid_items` table** — one row per linked institution (item) | An item is a different grain than an account: one item → many accounts. Holds the encrypted access token, the transactions cursor, and item status/error. |
| Sync engine | **Webhook-driven (`SYNC_UPDATES_AVAILABLE`) + hourly cron fallback**, cursor stored per item | `/transactions/sync` is incremental via `next_cursor`; webhooks make it near-real-time, cron guarantees freshness if a webhook is missed. Logged via `sync_runs`/`error_events`. |
| Re-auth | **Item status drives a reconnect affordance** (Link **update mode**, not a fresh connect) | `ITEM_LOGIN_REQUIRED` is Plaid's analogue of an expired OAuth token; update mode re-auths the same item in place. |
| New client dependency | **Add `react-plaid-link`** (the official web SDK, `usePlaidLink` hook) | This is the one genuinely-new client-side dependency in the project — flagged explicitly (everything else has been server-side). |
| Build/test target | **Sandbox first**, production approval in parallel | Sandbox is immediate and free (live-data testing up to 200 calls/product); the whole slice is buildable before production access lands. |

## 3. Landing zones

### 3a. Balances → existing `finance_accounts` (no new table; reuses the 1A.4 model)

`public.finance_accounts` (`20260527120005`) already has every column Plaid needs:

```
finance_accounts (
  id uuid pk, user_id uuid, name text, type text check (BANK|HYSA|EQUITY|RETIRE|CRYPTO|PRIVATE|T_BILLS),
  current_value numeric(18,2), plaid_account_id text, source text check (manual|plaid|coinbase),
  created_at, updated_at
)
```

**Reconciliation contract (the central balances decision):**
- A Plaid account is upserted on **`(user_id, plaid_account_id)`** with `source='plaid'`. **Add a partial-unique index** `unique (user_id, plaid_account_id) where plaid_account_id is not null` so the upsert is idempotent and **manual rows (whose `plaid_account_id` is NULL) are never touched** (NULLs are distinct, mirroring the `workouts` NULL-external-id rule).
- **Never modify a `source='manual'` row.** Plaid only ever writes/updates rows it owns (`source='plaid'`). A manual "Chase Checking" and a Plaid-linked "Chase Checking" can coexist as two rows; de-duping is the user's choice, not the sync's (out of scope — YAGNI).
- **Balance mapping:** Plaid's `accounts[].balances.current` → `current_value`. Map Plaid's account `type`/`subtype` → the existing `type` enum via a small lookup (`depository/checking|savings → BANK` or `HYSA`; `investment → EQUITY`/`RETIRE`; `credit → BANK` as a liability with negative `current_value`; unknown → `BANK`). Pin this lookup at plan time against the verified Plaid account-type list.
- **Net worth + sparkline read both sources unchanged.** The Finance page already sums `finance_accounts.current_value` across all rows and reads `finance_snapshots` for the 30-day trajectory — **no page query change for balances**. The sync also writes a daily `finance_snapshots` row per Plaid account (`unique (account_id, date)`, the existing key) so the sparkline reflects real balance history.

### 3b. Item store → new `plaid_items` table (one migration)

One row per linked institution (Plaid "item"). This is the Plaid analogue of the `integrations` row, but item-grained and finance-specific (an item maps to many accounts).

```
public.plaid_items (
  id uuid pk,  user_id uuid not null → auth.users on delete cascade,
  item_id text not null,                 -- Plaid item_id (stable per linked institution)
  access_token text not null,            -- AES-256-GCM ciphertext (REUSE src/lib/crypto/tokens.ts)
  institution_id text,  institution_name text,
  transactions_cursor text,              -- /transactions/sync next_cursor; null until first sync
  status text not null default 'connected' check (status in ('connected','login_required','error')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
)
```

Full RLS (own-row select/insert/update/delete, mirroring every other table) + `set_updated_at` trigger + index `(user_id, status)`. **The access token is stored encrypted here, not in `integrations`** — Plaid's per-item model doesn't fit the single-row-per-provider `integrations` shape, and there's no refresh token to manage. (Settings still shows a single "Plaid" connection row driven by the **presence/aggregate status of `plaid_items`** — see §4.)

### 3c. Transactions → new `transactions` table (one migration)

Lightly provider-agnostic (source-tagged), mirroring the `workouts`-table philosophy:

```
public.transactions (
  id uuid pk,  user_id uuid not null → auth.users on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete cascade,  -- internal FK; nullable until the account row exists
  source text not null default 'plaid' check (source in ('plaid','manual','coinbase')),
  external_id text,                      -- Plaid transaction_id; null for manual
  plaid_account_id text,                 -- raw Plaid account id, for resolving account_id
  amount numeric(18,2) not null,         -- normalized; see sign convention below
  iso_currency_code text,
  date date not null,                    -- Plaid 'date' (authorized/posted)
  name text,                             -- raw description (Plaid 'name')
  merchant_name text,                    -- Plaid-enriched merchant
  category_primary text,                 -- personal_finance_category.primary
  category_detailed text,                -- personal_finance_category.detailed
  pending boolean not null default false,
  source_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)  -- idempotent provider upserts; manual rows keep external_id null
)
```

Full RLS + index `(user_id, date desc)`.

- **Upsert key:** `(user_id, source, external_id)` — the same idempotency model as `workouts`/`calendar_events`. The Plaid `transaction_id` is the stable external id. **Drop any synced transaction lacking a non-null `external_id`** (never insert a NULL-id provider row — NULLs are distinct in the unique index and would duplicate every sync).
- **`removed` handling:** `/transactions/sync` returns a `removed` array of transaction ids; the sync **deletes** those rows by `(user_id, source='plaid', external_id)`. **`modified`** rows are handled by the same upsert as `added`.
- **`account_id` resolution:** Plaid transactions carry a raw `plaid_account_id`; we store it and resolve the internal `finance_accounts.id` (matched on `(user_id, plaid_account_id)`). Because balances and transactions arrive in the **same** `/transactions/sync` response, **upsert the accounts first, then the transactions**, so the FK resolves in one pass.
- **Sign convention:** Plaid uses positive `amount` for money *leaving* the account (outflow). Pin the stored convention at plan time (recommend storing Plaid's raw signed amount + documenting it, and formatting sign in the UI) — and **unit-test the chosen mapping**, since it's the one easy-to-get-wrong piece.

## 4. Components

- **Plaid client lib** (`src/lib/plaid/client.ts`) — a thin authed wrapper over the Plaid REST API (using the official `plaid` Node SDK or `fetch`; decide at plan time). Helpers: `createLinkToken(userId)`, `exchangePublicToken(publicToken)`, `transactionsSync(accessToken, cursor)` (paginates on `has_more`, accumulating `added`/`modified`/`removed` + final `next_cursor`), plus a typed `PlaidApiError` (status + truncated body) mirroring `GoogleCalendarError`/`WhoopApiError`. **No refresh logic** — the access token is durable.
- **Link-token route** (`GET /api/plaid/link-token`) — auth-guarded (`getCurrentUserId`); calls `/link/token/create` with `client_name`, `language='en'`, `country_codes=['US']`, `products=['transactions']` (transactions implies balances/accounts access — the `/transactions/sync` response carries the `accounts` array), `user.client_user_id = userId`, the `webhook` URL, and the `redirect_uri` (needed for OAuth-bank institutions inside Link). Returns `{ link_token }`. This replaces the Google/Whoop `connect` redirect route — Plaid mints a token the client SDK consumes.
- **Link client component** (`src/app/(app)/settings/PlaidLinkButton.tsx`, `"use client"`) — uses **`react-plaid-link`**'s `usePlaidLink({ token, onSuccess })` hook. Fetches the `link_token` from the route, opens the Plaid modal, and on `onSuccess(public_token)` calls the exchange action. **This is the one new client-side dependency** (`react-plaid-link`) — flag it in the plan.
- **Exchange action** (`exchangePlaid(publicToken)` server action in `_actions/connections.ts`) — exchanges via `/item/public_token/exchange`, **encrypts the `access_token` (reuse `encryptToken`)**, inserts/updates the `plaid_items` row (institution name from `/institutions/get_by_id` or the Link metadata), then runs an **inline initial backfill** (`syncPlaid` for that item) so balances + transactions show immediately. Mirrors the role of the Whoop callback's inline backfill, but as a server action (no redirect round-trip).
- **Plaid sync core** (`src/lib/sync/plaid.ts`) — `syncPlaidItem(client, userId, item)`: load the item, decrypt the access token, call `transactionsSync(token, item.transactions_cursor)` looping until `has_more=false`; **(a)** upsert the `accounts` array → `finance_accounts` (`onConflict: user_id,plaid_account_id`, source `plaid`) + write daily `finance_snapshots`; **(b)** upsert `added`+`modified` → `transactions`, **delete** `removed`; **(c)** persist the new `next_cursor` onto `plaid_items`; **(d)** stamp `last_synced_at`, write `sync_runs` (`provider='plaid'`), and on per-stream failure record `error_events` `{ context: { stage: 'syncPlaidAccounts' | 'syncPlaidTransactions' } }` with **failure isolation** (a transactions hiccup keeps `status='connected'`; only an item-auth error flips status). A `syncPlaid(client, userId)` wrapper iterates the user's items. **Persist the cursor only after the dependent writes succeed**, so a crash re-fetches the same delta rather than skipping it (cursor advancement is the finance analogue of Whoop's write-before-use ordering).
- **Webhook handler** (`POST /api/plaid/webhook`) — **verifies every request** before acting: extract the `Plaid-Verification` JWT header, read its `kid`, fetch the key via `/webhook_verification_key/get`, verify the **ES256** signature, check `iat` freshness (reject > 5 min old), and **constant-time-compare** the body's SHA-256 against the JWT's `request_body_sha256` claim. On a verified `SYNC_UPDATES_AVAILABLE` (also handle `INITIAL_UPDATE`/`HISTORICAL_UPDATE`/`TRANSACTIONS_REMOVED`) → look up the `plaid_items` row by `item_id`, then `syncPlaidItem` via the **service-role admin client** (no user cookie in a webhook). On an `ITEM` error webhook (`ITEM_LOGIN_REQUIRED`) → set `plaid_items.status='login_required'`. **Reject unverified requests with 401** and never log raw financial payloads.
- **Cron fallback route** (`GET /api/plaid/sync`) — hourly; **reuse the constant-time `CRON_SECRET` check** (`authMatches` from `google-calendar/sync`); select `plaid_items` where `status='connected'`; call `syncPlaidItem` per item. Belt-and-suspenders for missed webhooks.
- **Plaid Connections row** — render a single **"Plaid · FINANCE"** row in `ConnectionsCard` via the generalized `ProviderConnectionRow` (or a small Plaid-specific row if the generalized one assumes a `connectPath` redirect — Plaid uses the Link button, not an `<a href>`). Status is the **aggregate of `plaid_items`** (any `login_required` → show **RECONNECT** → opens Link **update mode**; else **CONNECTED** with the freshest `last_synced_at`). Disconnect calls `/item/remove` for each item then deletes the `plaid_items` rows (and optionally the `source='plaid'` accounts/transactions — decide at plan time; recommend removing Plaid-owned rows so disconnect is clean).
- **Transactions view** (`src/components/modules/finance/TransactionsList.tsx` + a section on `finance/page.tsx`) — a compact list of recent `transactions` rows (date, merchant_name||name, amount with sign/colour, `category_primary`, a PENDING chip). Reads `transactions` via the cookie client (RLS), `order by date desc limit ~25`. Mirrors the styling of `CalendarList`/`ActivityList`. This is the one genuinely-new finance screen element; the Accounts/net-worth/allocation cards need **no change** (they already read `finance_accounts`).

## 5. Sync & data-flow architecture

- **Connect:** Settings → `PlaidLinkButton` fetches `link_token` → Plaid Link modal (bank login) → `onSuccess(public_token)` → `exchangePlaid` action → encrypted `access_token` stored in `plaid_items` → **inline backfill** (`syncPlaidItem`, cursor null → full 90-day history by default).
- **Cursor-based incremental engine:** each `plaid_items` row stores its `transactions_cursor`. A sync calls `/transactions/sync` with the stored cursor, applies `added`/`modified` (upsert) + `removed` (delete) + the `accounts` balances (upsert), loops while `has_more`, then **persists `next_cursor` last**. Idempotent: transactions keyed on `(user_id, source, external_id)`, accounts on `(user_id, plaid_account_id)`.
- **Two triggers, one engine:** (1) **webhook** `SYNC_UPDATES_AVAILABLE` → near-real-time sync of the affected item (admin client); (2) **hourly cron** → sweeps all `connected` items as a safety net. Both call the same `syncPlaidItem`.
- **Failure isolation & freshness:** an accounts-stream or transactions-stream error records `error_events` + a `partial` `sync_run` but **keeps the item `connected`** (a data hiccup must not raise the reconnect affordance). Only `ITEM_LOGIN_REQUIRED` (via webhook or a fetch error) flips `plaid_items.status='login_required'`, surfacing the RECONNECT → Link-update-mode path.
- **Admin-client RLS discipline:** the webhook and cron paths use the service-role admin client (bypasses RLS), so **every read/write is explicitly scoped by `user_id`** (same rule as the Whoop/Google cron paths). The webhook resolves `user_id` from the `plaid_items` row matched on `item_id`.

## 6. New environment variables

| Var | Purpose |
|---|---|
| `PLAID_CLIENT_ID` | Plaid API client id (same across environments) |
| `PLAID_SECRET` | Plaid API secret — **environment-specific** (Sandbox secret vs Production secret) |
| `PLAID_ENV` | `sandbox` or `production` (selects the API host; default `sandbox` for the build) |
| `PLAID_WEBHOOK_URL` | `https://personal-os-azure-eight.vercel.app/api/plaid/webhook` |
| `PLAID_REDIRECT_URI` | `https://personal-os-azure-eight.vercel.app/settings` (registered in the dashboard; needed for OAuth-bank institutions inside Link) |

Reuses existing `TOKEN_ENCRYPTION_KEY` (encrypts the item access token), `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. New env getters added to `src/lib/env.ts` (mirroring `getWhoop*`), reading at call time so the build never throws on absence.

## 7. Security

- **Heightened privacy posture (financial data).** Treat balances and transactions as the most sensitive data in the app. **Never log financial PII** — no amounts, merchant names, account numbers, or raw Plaid payloads in `error_events`, `console`, or `sync_runs` (log counts + stage tags only, e.g. `{ stage: 'syncPlaidTransactions', count: n }`).
- **Item access tokens encrypted at rest** with the existing AES-256-GCM (`src/lib/crypto/tokens.ts`); decrypted only in-memory during a sync; never returned to the client.
- **Webhook verification is mandatory** — every `/api/plaid/webhook` request is rejected (401) unless its `Plaid-Verification` ES256 JWT verifies against the key from `/webhook_verification_key/get`, the `iat` is fresh (< 5 min), and the constant-time SHA-256 body comparison matches. No action is taken on an unverified request.
- **Cron route** guarded by the constant-time `CRON_SECRET` check (reused, not re-implemented).
- **RLS on `plaid_items` + `transactions`** (own-row only); admin-client (webhook/cron) writes always filter `user_id` explicitly since they bypass RLS.
- **No secrets client-side.** The Link client component only ever receives a short-lived `link_token`; `PLAID_CLIENT_ID`/`PLAID_SECRET` stay server-only. The `public_token` is exchanged server-side; the durable `access_token` never reaches the browser.
- **Disconnect** calls `/item/remove` (revokes Plaid's access) before deleting local rows.

## 8. Acceptance gate

> Connect a bank via **Settings → Plaid → Connect** (Plaid Link modal, Sandbox credentials) → **balances appear in the Finance Accounts list** (source `plaid`, alongside manual accounts) and the **net-worth total + sparkline include them** → the **Finance Transactions section shows real categorized transactions** (merchant, amount, category, pending) → at least one **webhook-triggered** sync lands new data, and the **hourly cron** also runs a sync → disconnect removes the Plaid accounts/transactions and the row returns to NOT CONNECTED → simulate `ITEM_LOGIN_REQUIRED` (Sandbox) and confirm the row shows **RECONNECT** and Link **update mode** restores it.
>
> **Manual-coexistence contract test:** with a manually-entered account present, connect Plaid and confirm the **manual account is untouched** (not overwritten, not deleted) while Plaid accounts appear as additional rows and net worth sums both.
>
> **Idempotency test:** run the same `/transactions/sync` delta twice (or re-run a cron tick) and confirm **no duplicate transactions** and balances are stable (upsert keys hold).
>
> **Webhook-verification test:** send an unsigned/invalid-JWT request to `/api/plaid/webhook` and confirm it is **rejected 401** with no DB write.

## 9. Out of scope (deferred)

- **Budgeting, forecasting, spend analytics, category editing, recurring-transaction detection** (`RECURRING_TRANSACTIONS_UPDATE` ignored) — display only.
- **Auto-dedup of manual vs Plaid accounts** — both coexist; reconciliation is the user's manual choice.
- **Investments holdings / securities detail, Liabilities product, Auth (account/routing numbers), Identity, Income, Transfer** — not enabled; `products=['transactions']` only.
- **Multi-currency normalization** — store `iso_currency_code`, display as-is; no FX conversion.
- **Coinbase / other finance sources** — the `transactions` table is source-tagged to allow them later, but only Plaid is built here.

## 10. Max's one-time setup (Plaid dashboard — START THIS FIRST; production access is the critical path)

> **Pre-flight order across the roadmap puts Plaid FIRST** even though it builds last, because production access is human-gated. Sandbox is immediate; kick off the production application the same day so it's approved by the time the slice is built and ready to point at real banks.

**Sandbox (immediate — unblocks the entire build):**
1. Sign up at **dashboard.plaid.com** (free). A team is created with **Sandbox** access immediately, and (for teams created on/after **April 15, 2026**) an auto-approved **Trial plan** that allows real-data testing with **up to 10 Production Items** across almost all institutions.
2. **Keys** → copy **`PLAID_CLIENT_ID`** and the **Sandbox `PLAID_SECRET`**.
3. **API → Allowed redirect URIs** → add `https://personal-os-azure-eight.vercel.app/settings` (and `http://localhost:3000/settings` for local). Set **`PLAID_REDIRECT_URI`** to the production one.
4. **Webhooks** → register `https://personal-os-azure-eight.vercel.app/api/plaid/webhook`. Set **`PLAID_WEBHOOK_URL`**.
5. Set in Vercel (Production) **and** `.env.local`: `PLAID_CLIENT_ID`, `PLAID_SECRET` (Sandbox value to start), `PLAID_ENV=sandbox`, `PLAID_WEBHOOK_URL`, `PLAID_REDIRECT_URI`. Redeploy. **The whole slice can now be built + demoed against Sandbox.**

**Production access (the long pole — apply on day one):**
6. In the dashboard, **request Production access**. You'll provide **company details, your use case, and answer a data-security/compliance questionnaire**.
7. **Realistic lead time:** approval typically takes **a couple of business days, and you should allow up to ~1 week** for processing. (A Trial plan gives limited real-data access sooner — up to 10 Production Items — but full Production removes that cap and broadens institution coverage.)
8. Once approved: copy the **Production `PLAID_SECRET`**, set `PLAID_ENV=production` + the Production secret in Vercel, and re-link (Sandbox items don't carry over).

> **Note on environments:** Plaid now has only **Sandbox** and **Production** — the old **Development** environment was **decommissioned June 20, 2024**. Don't target `development`.

**Billing acknowledgement:** Plaid is **pay-as-you-go, product-based** (per-request / subscription depending on product). Sandbox is free; the Trial plan is free up to its item cap. In Production, **Transactions and Balance are billable** (no upfront commitment on Pay-as-you-go). Cost scales with linked items + transaction volume — acknowledged, not optimized, in this slice (single-user usage is minimal).

## 11. Open items to resolve at planning time

- **Plaid SDK choice:** official `plaid` Node SDK vs hand-rolled `fetch`. The Node SDK handles env hosts + types but adds a server dependency; `fetch` keeps it light (mirrors the Whoop client). Recommend evaluating both; the verified endpoints/fields are stable either way.
- **`react-plaid-link` version + React 19 compatibility** — verify the current `usePlaidLink` API and confirm it works under **React 19 / Next.js 16** before locking the client component (this is the one new client dependency; check for peer-dep warnings).
- **Amount sign convention** — pin and **unit-test** the stored sign (Plaid: positive = outflow). Decide store-raw-vs-normalize and the UI formatting/colour rule.
- **Plaid account-type → `finance_accounts.type` enum lookup** — build the mapping table at plan time against the verified Plaid `type`/`subtype` list (credit-card liabilities likely store negative `current_value`).
- **Transactions cursor + the two triggers racing** — ensure the webhook-driven sync and the hourly cron (and the inline backfill) **don't run concurrently for the same item** (a per-item advisory lock or "skip if a sync started < N seconds ago" guard); the cursor must advance atomically.
- **Connections row reuse** — confirm whether the generalized `ProviderConnectionRow` (built for OAuth `connectPath` redirects) can render the Link-button-driven Plaid row, or whether Plaid needs a small dedicated row component (likely the latter, since Link is a modal not an `<a href>`).
- **Disconnect semantics** — confirm with Max whether disconnect should **delete** Plaid-owned accounts/transactions (recommended, clean) or keep them as a frozen snapshot.
- **Webhook ↔ cron overlap on Vercel** — confirm the webhook route's `maxDuration` (set `60`) covers a full multi-page backfill, and that the hourly cron is registered in `vercel.json` alongside the existing entries.
- **Live API re-verification at build:** re-confirm against **plaid.com/docs** the exact `/link/token/create`, `/item/public_token/exchange`, `/transactions/sync`, and `/webhook_verification_key/get` request/response field names and the `personal_finance_category` taxonomy before locking the mappers — training data is stale; this spec was verified 2026-06-05 against the live docs cited below.

---

### Live Plaid docs verified against (2026-06-05)

- Link / `/link/token/create`: https://plaid.com/docs/api/link/
- Item exchange + lifecycle (`/item/public_token/exchange`, `ITEM_LOGIN_REQUIRED`, durable non-rotating access_token): https://plaid.com/docs/api/items/
- Transactions sync (cursor, `added`/`modified`/`removed`/`next_cursor`/`has_more`, 90-day default backfill, `accounts` array with balances, `personal_finance_category`): https://plaid.com/docs/api/products/transactions/
- Webhook verification (`/webhook_verification_key/get`, `Plaid-Verification` ES256 JWT, `request_body_sha256`) + webhook types (`SYNC_UPDATES_AVAILABLE`, `INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `TRANSACTIONS_REMOVED`): https://plaid.com/docs/api/webhooks/webhook-verification/
- Quickstart (environments Sandbox/Production; `react-plaid-link` / `usePlaidLink`): https://plaid.com/docs/quickstart/
- Pricing (pay-as-you-go, product-based; Transactions + Balance billable; free Sandbox): https://plaid.com/pricing/
- Environments + production access timeline + Development decommission (June 20, 2024) + Trial plans (April 15, 2026, up to 10 Production Items, auto-approved): https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different and https://plaid.com/docs/launch-checklist/
