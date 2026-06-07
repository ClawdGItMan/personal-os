# Plaid Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **You are a fresh session with no prior context. Read this whole plan + the spec before starting.** The Whoop slice (1B.2) is merged and is your working template — reuse its **crypto** (`src/lib/crypto/tokens.ts`, AES-256-GCM), its **`sync_runs` / `error_events`** observability, and its **Vercel cron** pattern. Do NOT break the live Google or Whoop integrations (there's a regression gate at the end).
>
> **Plaid is NOT an OAuth-redirect integration** like Google/Whoop. It uses **Plaid Link** (a client-side modal) plus a `public_token` → `access_token` exchange. The Plaid `access_token` is **DURABLE and does NOT rotate** — the exact inverse of Whoop's single-use rotating refresh token, so there is **no refresh-token machinery here at all**. Build and test the **entire** slice against the **Plaid SANDBOX**; production approval runs in parallel (human-gated, ~1 week — see Pre-flight).
>
> **Before writing ANY Plaid API code, open the CURRENT docs at https://plaid.com/docs and verify endpoints, request/response field names, the `personal_finance_category` taxonomy, the account `type`/`subtype` enums, and the webhook-verification scheme.** Your training data for the Plaid API is unreliable. The mappers and reducers below specify the *contract + sign/precision/precedence logic* (which is tested); you must confirm the actual field names against the live docs and fix the extraction.

**Goal:** Max connects a bank/brokerage once from Settings via Plaid Link; his balances flow into the existing Finance Accounts list (feeding net worth + the 30-day sparkline, never clobbering manual accounts) and his categorized transactions render in a new Transactions section, kept fresh by Plaid webhooks with an hourly Vercel Cron fallback.

**Architecture:** A thin authed Plaid client (official `plaid` Node SDK) backs a cursor-based `/transactions/sync` engine. Connect flow = a Link client component → a `link-token` route → an `exchangePlaid` server action that encrypts the durable `access_token` into a new `plaid_items` table and runs an inline backfill. The sync core applies `added`/`modified` (upsert) + `removed` (delete) to a new provider-agnostic `transactions` table and upserts the `accounts` balances into the existing `finance_accounts` (partial-unique on `plaid_account_id`, so manual rows are untouched), persisting the cursor LAST. Two triggers (webhook + hourly cron) share one engine, guarded by a per-item concurrency lock so they can never race the cursor.

**Tech Stack:** Next.js 16 (App Router route handlers + server actions), React 19 client component (`react-plaid-link` `usePlaidLink` — the one genuinely-new client dependency), official `plaid` Node SDK (server-only), Supabase (`@supabase/ssr` cookie client + `@supabase/supabase-js` service-role admin client), Node `crypto` (reuse AES-256-GCM token encryption; `jose` for ES256 JWT verification), Zod, Vitest, Playwright, Vercel Cron (Pro).

**Spec:** `docs/superpowers/specs/2026-06-05-personal-os-plaid-design.md` (read it — it has the reconciliation contract, the privacy posture, the cursor-ordering rationale, and the out-of-scope list).

**Foundation templates (read these first — you will mirror them):**
- `src/lib/crypto/tokens.ts` — `encryptToken` / `decryptToken` (REUSE as-is to encrypt the Plaid access token)
- `src/lib/google/calendar.ts` — fetch + mapper + **typed error** pattern (`GoogleCalendarError` → your `PlaidApiError`)
- `src/lib/sync/calendar.ts` — sync-core scaffolding: `sync_runs` / `error_events` logging, try/catch isolation, passed-client discipline (Task 6 mirrors it, minus all refresh logic)
- `src/app/api/google-calendar/sync/route.ts` — the **constant-time `CRON_SECRET`** `authMatches` helper (copy it into the Plaid cron + reuse the idea for the webhook)
- `src/app/(app)/settings/GoogleConnectionRow.tsx`, `ConnectionsCard.tsx`, `_actions/connections.ts` — the Settings connection-row + actions pattern (Plaid needs a DEDICATED modal-driven row, not the redirect-based one)
- `src/components/modules/calendar/CalendarList.tsx` — list-row styling + the invalid-timezone→UTC `formatWhen` fallback (TransactionsList mirrors it)
- `src/app/(app)/finance/page.tsx` — already sums `finance_accounts.current_value` + reads `finance_snapshots`; balances need NO query change here, only a new Transactions section
- `src/lib/supabase/admin.ts` (reused as-is), `src/lib/env.ts` (Task 1), `src/lib/action-result.ts` (`ActionResult`)

---

## Pre-flight — Max's one-time Plaid setup (START THIS FIRST; production access is the critical path)

> **Plaid builds last in the roadmap but its pre-flight starts FIRST.** Sandbox is immediate and unblocks the entire build; production access is human-gated (~a couple of business days, allow up to ~1 week). Kick off the production application the same day so it's approved by the time the slice is built. **The whole slice is built + demoed against Sandbox** — none of the tasks below need production.

Provide Max this click-by-click; confirm the env vars exist in Vercel before the live acceptance.

**Sandbox (immediate — unblocks the build):**
1. Sign up at **dashboard.plaid.com** (free). A team gets **Sandbox** access immediately (and, for teams created on/after April 15 2026, an auto-approved Trial plan allowing real-data testing up to 10 Production Items).
2. **Keys** → copy **`PLAID_CLIENT_ID`** and the **Sandbox `PLAID_SECRET`**.
3. **API → Allowed redirect URIs** → add `https://personal-os-azure-eight.vercel.app/settings` and `http://localhost:3000/settings`. Set **`PLAID_REDIRECT_URI`** to the production one.
4. **Webhooks** → register `https://personal-os-azure-eight.vercel.app/api/plaid/webhook`. Set **`PLAID_WEBHOOK_URL`**.
5. Set in Vercel (Production) **and** `.env.local`: `PLAID_CLIENT_ID`, `PLAID_SECRET` (Sandbox value to start), `PLAID_ENV=sandbox`, `PLAID_WEBHOOK_URL`, `PLAID_REDIRECT_URI`. Reuse the existing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (already set). Redeploy.

**Production access (the long pole — apply on day one):**
6. In the dashboard, **request Production access** (company details, use case, data-security questionnaire).
7. **Lead time:** typically a couple of business days; allow up to ~1 week.
8. Once approved: copy the Production `PLAID_SECRET`, set `PLAID_ENV=production` + the Production secret in Vercel, and re-link (Sandbox items don't carry over).

> Plaid now has only **Sandbox** and **Production** (the old Development environment was decommissioned June 20 2024). Don't target `development`.

**Cost note (acknowledged, not optimized):** Plaid is pay-as-you-go, product-based. Sandbox is free; the Trial plan is free up to its item cap. In Production, **Transactions and Balance are billable** (no upfront commitment on pay-as-you-go); cost scales with linked items + transaction volume. Single-user usage is minimal — acknowledged here, not optimized.

The env getters (Task 1) read `process.env` at call time, so the build/tasks below work without these set.

---

## File structure

**Create:**
- `supabase/migrations/20260605130000_create_plaid_items.sql` — item store (encrypted access token + cursor + status, incl. `login_required`)
- `supabase/migrations/20260605130001_create_transactions.sql` — provider-agnostic transactions table
- `supabase/migrations/20260605130002_finance_accounts_plaid_unique.sql` — partial-unique index on `(user_id, plaid_account_id) where plaid_account_id is not null`
- `src/lib/plaid/client.ts` — official-SDK-backed wrapper: `getPlaidClient()`, `createLinkToken`, `exchangePublicToken`, `transactionsSync` (paginates `has_more`), `removeItem`, `getWebhookVerificationKey`, `PlaidApiError`
- `src/lib/plaid/map.ts` — **pure** mappers: `mapAccount` (→ finance_accounts upsert row), `mapTransaction` (→ transactions row | null), `ACCOUNT_TYPE_MAP`
- `src/lib/plaid/map.test.ts` — TDD for the numeric mappings + account-type lookup
- `src/lib/plaid/reducer.ts` — **pure** `applyTransactionsDelta(existing, delta)` (the added/modified/removed reducer)
- `src/lib/plaid/reducer.test.ts` — TDD for the reducer
- `src/lib/plaid/verify.ts` — **pure-ish** `verifyWebhook({ headerJwt, rawBody, getKey })` → ES256 JWT + iat-freshness + constant-time body-hash compare
- `src/lib/plaid/verify.test.ts` — TDD for webhook verification (mocked key)
- `src/lib/plaid/lock.ts` — `withItemSyncLock(client, itemId, fn)` skip-if-recent/`syncing` concurrency guard
- `src/lib/plaid/lock.test.ts` — TDD for the lock decision (pure `shouldSkipSync`)
- `src/lib/sync/plaid.ts` — `syncPlaidItem(client, userId, item)` (accounts + transactions streams, isolated, logging, cursor-last) + `syncPlaid(client, userId)` wrapper
- `src/app/api/plaid/link-token/route.ts` — auth-guarded `GET` returning `{ link_token }`
- `src/app/api/plaid/webhook/route.ts` — `POST`; verifies every request, 401-no-write on failure (`export const maxDuration = 60;`)
- `src/app/api/plaid/sync/route.ts` — hourly cron fallback (`export const maxDuration = 60;`)
- `src/app/(app)/settings/PlaidConnectionRow.tsx` — **dedicated** Plaid row (modal-driven, NOT the redirect row)
- `src/app/(app)/settings/PlaidLinkButton.tsx` (`"use client"`) — `usePlaidLink` hook; opens the modal; calls `exchangePlaid`
- `src/components/modules/finance/TransactionsList.tsx` — presentational recent-transactions list
- `tests/e2e/plaid.spec.ts` — unauthenticated route guards + unsigned-webhook 401

**Modify:**
- `src/lib/env.ts` — add `getPlaidClientId/Secret/Env/WebhookUrl/RedirectUri`
- `src/lib/supabase/database.types.ts` — regenerate after the migrations (adds `plaid_items`, `transactions`)
- `src/app/(app)/settings/_actions/connections.ts` — add `exchangePlaid`, `disconnectPlaid`, `syncPlaidNow`, `createPlaidLinkToken`
- `src/app/(app)/settings/ConnectionsCard.tsx` — render the live Plaid row (drop the static Plaid placeholder)
- `src/app/(app)/finance/page.tsx` — add a Transactions section reading `transactions`
- `.env.example` — document `PLAID_*`
- `package.json` — add `plaid`, `react-plaid-link`, `jose` (Task 2)
- `vercel.json` — add the hourly Plaid cron

**Verify-only (no change expected):**
- `src/app/(app)/finance/page.tsx` net-worth/sparkline/allocation cards — already read `finance_accounts` + `finance_snapshots`; balances "just work" once Plaid rows land.

---

## Task 0: Migrations (plaid_items + transactions + partial-unique index) + regenerate types

**Files:** Create the three migration files; Modify `src/lib/supabase/database.types.ts`.

- [ ] **Step 1: Write `supabase/migrations/20260605130000_create_plaid_items.sql`** (mirror the RLS + `set_updated_at` pattern in `20260527120005_create_finance.sql`):

```sql
create table public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,                     -- Plaid item_id (stable per linked institution)
  access_token text not null,                -- AES-256-GCM ciphertext (reuse src/lib/crypto/tokens.ts)
  institution_id text,
  institution_name text,
  transactions_cursor text,                  -- /transactions/sync next_cursor; null until first sync
  status text not null default 'connected' check (status in ('connected','login_required','error')),
  last_error text,
  syncing_at timestamptz,                    -- concurrency guard: set when a sync starts, cleared when it ends
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.plaid_items enable row level security;
create policy "plaid_items_select_own" on public.plaid_items for select using (auth.uid() = user_id);
create policy "plaid_items_insert_own" on public.plaid_items for insert with check (auth.uid() = user_id);
create policy "plaid_items_update_own" on public.plaid_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plaid_items_delete_own" on public.plaid_items for delete using (auth.uid() = user_id);

create trigger plaid_items_set_updated_at before update on public.plaid_items
  for each row execute function public.set_updated_at();

create index plaid_items_user_status_idx on public.plaid_items (user_id, status);
```

- [ ] **Step 2: Write `supabase/migrations/20260605130001_create_transactions.sql`** (mirror the `workouts` provider-agnostic shape from `20260605120000_create_workouts.sql`):

```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete cascade,  -- nullable until the account row exists
  source text not null default 'plaid' check (source in ('plaid','manual','coinbase')),
  external_id text,                          -- Plaid transaction_id; null for manual
  plaid_account_id text,                     -- raw Plaid account id, for resolving account_id
  amount numeric(18,2) not null,             -- Plaid raw signed amount (positive = outflow); see map.test.ts
  iso_currency_code text,
  date date not null,
  name text,
  merchant_name text,
  category_primary text,
  category_detailed text,
  pending boolean not null default false,
  source_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.transactions enable row level security;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
```

- [ ] **Step 3: Write `supabase/migrations/20260605130002_finance_accounts_plaid_unique.sql`** — the partial-unique index so Plaid upserts are idempotent and **manual rows (NULL `plaid_account_id`) are never clobbered** (NULLs are distinct):

```sql
-- Plaid balance upserts target (user_id, plaid_account_id). Manual rows keep
-- plaid_account_id NULL, so the partial predicate excludes them entirely — a
-- manual "Chase Checking" can never be touched by a Plaid sync.
create unique index finance_accounts_user_plaid_uniq
  on public.finance_accounts (user_id, plaid_account_id)
  where plaid_account_id is not null;
```

- [ ] **Step 4: Apply the migrations to the Supabase project.** All three are additive (the index only constrains Plaid-owned rows). Use the Supabase MCP `apply_migration` tool (project ref `evpuwdkrypzugdgxtqak`), or `npx supabase db push` if the CLI is linked. **Confirm with the operator before applying to the live DB.**
- [ ] **Step 5: Regenerate types** so `Database["public"]["Tables"]["plaid_items"]` and `["transactions"]` exist. **Preferred:** the Supabase MCP `generate_typescript_types` tool (project ref `evpuwdkrypzugdgxtqak`) — the local `supabase` CLI may not be linked, so don't assume `supabase gen types` works without checking. Overwrite `src/lib/supabase/database.types.ts`. **HARD GATE:** run `grep -c "plaid_items" src/lib/supabase/database.types.ts && grep -c "transactions:" src/lib/supabase/database.types.ts` — if either returns `0`, the regen failed; **STOP and do not start any task that queries these tables (Tasks 6, 8, 9, 11, 12)** until both return > 0, or those tasks will fail `tsc`.
- [ ] **Step 6: Verify** `npx tsc --noEmit` clean.
- [ ] **Step 7: Commit** — `feat: plaid_items + transactions tables + finance_accounts plaid unique index (plaid)`

## Task 1: Plaid env getters

**Files:** Modify `src/lib/env.ts`, `.env.example`.

- [ ] **Step 1:** In `src/lib/env.ts`, add (mirroring `getGoogleClientId`; all read `process.env` at call time):

```ts
export function getPlaidClientId(): string { return requireEnv("PLAID_CLIENT_ID"); }
export function getPlaidSecret(): string { return requireEnv("PLAID_SECRET"); }
export function getPlaidEnv(): string { return process.env.PLAID_ENV?.trim() || "sandbox"; }
export function getPlaidWebhookUrl(): string { return requireEnv("PLAID_WEBHOOK_URL"); }
export function getPlaidRedirectUri(): string { return requireEnv("PLAID_REDIRECT_URI"); }
```

- [ ] **Step 2:** Append to `.env.example`:

```
# Plaid (dashboard.plaid.com) — Sandbox first; PLAID_SECRET is environment-specific
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-sandbox-secret
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=http://localhost:3000/api/plaid/webhook
PLAID_REDIRECT_URI=http://localhost:3000/settings
```

- [ ] **Step 3: Verify** `npx tsc --noEmit`. **Commit** — `feat: plaid env getters (plaid)`

## Task 2: Add dependencies + verify React 19 / Next 16 compatibility (DECISION TASK)

**Files:** Modify `package.json` (via the package manager).
**Decision recorded by the spec (open item resolved):** use the **official `plaid` Node SDK** server-side (it handles env hosts + request/response types; the slight dependency weight is worth the typed `TransactionsSyncResponse` etc.), `react-plaid-link` for the client, and `jose` for ES256 JWT verification (pure, audited, already common in the Next ecosystem). **Do NOT hand-roll `fetch`** — the typed SDK removes a whole class of field-name mistakes on the most correctness-sensitive integration.

- [ ] **Step 1: Add the server SDK + JWT lib:** `pnpm add plaid jose`.
- [ ] **Step 2: Add the client SDK:** `pnpm add react-plaid-link`.
- [ ] **Step 3: VERIFY React 19 / Next 16 compatibility (HARD GATE).** `react-plaid-link`'s peer deps may lag React 19. Run `pnpm why react` and `pnpm ls react-plaid-link` and check the install output for peer-dependency warnings about `react@19`.
  - If it installs clean (no unmet React 19 peer warning) → proceed.
  - If it warns/errors on the React 19 peer → **FALLBACK:** open the CURRENT `react-plaid-link` docs/releases at https://github.com/plaid/react-plaid-link to confirm the React-19-compatible version and pin it; if no compatible release exists, implement the **vanilla Plaid Link script fallback** — load `https://cdn.plaid.com/link/v2/stable/link-initialize.js` in `PlaidLinkButton.tsx` and call `Plaid.create({ token, onSuccess })` directly (documented in the same repo). Record which path was taken in the Notes section at the bottom of this plan.
- [ ] **Step 4: Verify** `pnpm install` is clean and `npx tsc --noEmit` passes. **Commit** — `chore: add plaid + react-plaid-link + jose deps (plaid)`

## Task 3: Plaid client wrapper

**Files:** Create `src/lib/plaid/client.ts`.
**Docs (READ FIRST — verify against https://plaid.com/docs):** `/link/token/create`, `/item/public_token/exchange`, `/transactions/sync`, `/item/remove`, `/webhook_verification_key/get`. Confirm the SDK method names (`linkTokenCreate`, `itemPublicTokenExchange`, `transactionsSync`, `itemRemove`, `webhookVerificationKeyGet`) and the `PlaidEnvironments` host map.

This is a thin server-only wrapper (mirror the typed-error shape of `src/lib/google/calendar.ts`). No unit test — it's HTTP plumbing covered by manual sandbox acceptance; the *pure* logic it feeds (mappers, reducer, verify) is tested separately.

- [ ] **Step 1: Implement** `src/lib/plaid/client.ts`:

```ts
import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import {
  getPlaidClientId, getPlaidSecret, getPlaidEnv,
  getPlaidWebhookUrl, getPlaidRedirectUri,
} from "@/lib/env";

/** Carries the Plaid HTTP status + a truncated body, mirroring GoogleCalendarError. */
export class PlaidApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PlaidApiError";
    this.status = status;
  }
}

/** Build the authed SDK client. Reads env at call time (never module top-level). */
export function getPlaidClient(): PlaidApi {
  const env = getPlaidEnv(); // "sandbox" | "production"
  const config = new Configuration({
    basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": getPlaidClientId(),
        "PLAID-SECRET": getPlaidSecret(),
      },
    },
  });
  return new PlaidApi(config);
}

/** Wrap an SDK call so any Plaid HTTP error becomes a typed PlaidApiError with a
 *  TRUNCATED message — NEVER include financial PII in the thrown message. */
async function call<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: { error_code?: string } } };
    const status = e.response?.status ?? 0;
    // Only the error_code (never the body/PII) goes into the message.
    const code = e.response?.data?.error_code ?? "unknown";
    throw new PlaidApiError(`${label} failed: ${status} ${code}`, status);
  }
}

export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();
  const res = await call("link/token/create", () =>
    client.linkTokenCreate({
      client_name: "Personal OS",
      language: "en",
      country_codes: ["US"],
      products: ["transactions"], // transactions implies accounts/balances in the sync response
      user: { client_user_id: userId },
      webhook: getPlaidWebhookUrl(),
      redirect_uri: getPlaidRedirectUri(), // needed for OAuth-bank institutions inside Link
    } as Parameters<typeof client.linkTokenCreate>[0]),
  );
  return res.data.link_token;
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const client = getPlaidClient();
  const res = await call("item/public_token/exchange", () =>
    client.itemPublicTokenExchange({ public_token: publicToken }),
  );
  return { accessToken: res.data.access_token, itemId: res.data.item_id };
}

export interface PlaidSyncResult {
  added: unknown[];
  modified: unknown[];
  removed: { transaction_id: string }[];
  accounts: unknown[];
  nextCursor: string;
}

/** Loop /transactions/sync until has_more=false, accumulating added/modified/removed
 *  and the LATEST accounts snapshot + final next_cursor. */
export async function transactionsSync(
  accessToken: string,
  cursor: string | null,
): Promise<PlaidSyncResult> {
  const client = getPlaidClient();
  const added: unknown[] = [];
  const modified: unknown[] = [];
  const removed: { transaction_id: string }[] = [];
  let accounts: unknown[] = [];
  let nextCursor = cursor ?? "";
  let hasMore = true;

  while (hasMore) {
    const res = await call("transactions/sync", () =>
      client.transactionsSync({
        access_token: accessToken,
        cursor: nextCursor || undefined, // omit on the very first call
        options: { include_personal_finance_category: true },
      }),
    );
    const d = res.data;
    added.push(...d.added);
    modified.push(...d.modified);
    removed.push(...d.removed);
    accounts = d.accounts; // each page carries the current accounts snapshot
    nextCursor = d.next_cursor;
    hasMore = d.has_more;
  }
  return { added, modified, removed, accounts, nextCursor };
}

export async function removeItem(accessToken: string): Promise<void> {
  const client = getPlaidClient();
  await call("item/remove", () => client.itemRemove({ access_token: accessToken }));
}

/** Fetch the ES256 verification key (JWK) for a given kid. Used by verify.ts. */
export async function getWebhookVerificationKey(kid: string): Promise<unknown> {
  const client = getPlaidClient();
  const res = await call("webhook_verification_key/get", () =>
    client.webhookVerificationKeyGet({ key_id: kid }),
  );
  return res.data.key;
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` (you may need to adjust SDK types/casts after reading the live docs — fix the field names, keep the shape). **Commit** — `feat: plaid client wrapper (durable token, no refresh) (plaid)`

## Task 4: Pure mappers — `mapAccount`, `mapTransaction`, account-type lookup — TDD

**Files:** Create `src/lib/plaid/map.ts`, `src/lib/plaid/map.test.ts`.
**Docs (READ FIRST):** https://plaid.com/docs — the account `type`/`subtype` enum, `accounts[].balances`, and the `personal_finance_category` taxonomy. The TWO numeric mappings below are the easy-to-get-wrong pieces that feed net worth — they are tested.

**Mapping rules (the contract the tests pin):**
- **Amount sign convention:** store **Plaid's raw signed `amount`** (positive = money leaving the account / outflow; negative = inflow). Document this on the column; the UI formats the sign/colour. Storing raw avoids a double-negation bug and keeps the value reconcilable against Plaid.
- **Account-type → `finance_accounts.type` enum** via `ACCOUNT_TYPE_MAP`: `depository/checking|savings → BANK` (treat `savings` as `BANK`; a dedicated HYSA classification is the user's manual choice — YAGNI), `investment → EQUITY` (retirement subtypes `401k|ira|roth|...` → `RETIRE`), `credit → BANK`, unknown → `BANK`.
- **Credit-card balance as a negative `current_value`:** a `credit` account's `balances.current` is what's OWED, so it is a **liability** — store it as **`-balance`** so net worth subtracts it. (Depository/investment store the balance as-is.) This is the second tested numeric mapping.

- [ ] **Step 1: Failing tests** in `src/lib/plaid/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapAccount, mapTransaction, ACCOUNT_TYPE_MAP } from "./map";

describe("mapAccount → finance_accounts upsert row", () => {
  it("maps a depository checking account at face value", () => {
    const row = mapAccount({
      account_id: "acc-1", name: "Everyday Checking",
      type: "depository", subtype: "checking",
      balances: { current: 1234.56, iso_currency_code: "USD" },
    });
    expect(row).toMatchObject({
      plaid_account_id: "acc-1", source: "plaid",
      name: "Everyday Checking", type: "BANK", current_value: 1234.56,
    });
  });

  it("maps an investment account to EQUITY (retirement subtype → RETIRE)", () => {
    expect(mapAccount({ account_id: "a", name: "Brokerage", type: "investment", subtype: "brokerage", balances: { current: 50000 } }).type).toBe("EQUITY");
    expect(mapAccount({ account_id: "a", name: "401k", type: "investment", subtype: "401k", balances: { current: 80000 } }).type).toBe("RETIRE");
  });

  it("stores a credit-card balance as NEGATIVE current_value (a liability)", () => {
    const row = mapAccount({
      account_id: "cc", name: "Sapphire", type: "credit", subtype: "credit card",
      balances: { current: 842.10, iso_currency_code: "USD" },
    });
    expect(row.type).toBe("BANK");
    expect(row.current_value).toBe(-842.10); // owed → subtracts from net worth
  });

  it("falls back to BANK for an unknown type", () => {
    expect(mapAccount({ account_id: "x", name: "?", type: "other" as never, subtype: null, balances: { current: 0 } }).type).toBe("BANK");
  });
});

describe("mapTransaction → transactions row | null", () => {
  it("stores Plaid's RAW signed amount (positive = outflow) and sets keys", () => {
    const row = mapTransaction({
      transaction_id: "t-1", account_id: "acc-1", amount: 12.34,
      iso_currency_code: "USD", date: "2026-06-04",
      name: "BLUE BOTTLE", merchant_name: "Blue Bottle Coffee",
      personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
      pending: false,
    });
    expect(row).toMatchObject({
      source: "plaid", external_id: "t-1", plaid_account_id: "acc-1",
      amount: 12.34, date: "2026-06-04", name: "BLUE BOTTLE",
      merchant_name: "Blue Bottle Coffee",
      category_primary: "FOOD_AND_DRINK", category_detailed: "FOOD_AND_DRINK_COFFEE",
      pending: false,
    });
  });

  it("keeps a negative amount (a refund / inflow) raw", () => {
    expect(mapTransaction({ transaction_id: "t-2", account_id: "a", amount: -50, date: "2026-06-04" }).amount).toBe(-50);
  });

  it("drops a transaction with no transaction_id (never insert a null external_id)", () => {
    expect(mapTransaction({ account_id: "a", amount: 1, date: "2026-06-04" } as never)).toBeNull();
  });
});

describe("ACCOUNT_TYPE_MAP", () => {
  it("covers the four Plaid top-level types", () => {
    expect(ACCOUNT_TYPE_MAP.depository).toBe("BANK");
    expect(ACCOUNT_TYPE_MAP.investment).toBe("EQUITY");
    expect(ACCOUNT_TYPE_MAP.credit).toBe("BANK");
  });
});
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/plaid/map.test.ts` (FAIL: module/exports missing).
- [ ] **Step 3: Implement** `src/lib/plaid/map.ts`:
  - `ACCOUNT_TYPE_MAP: Record<string,"BANK"|"EQUITY"|"RETIRE">` for the top-level types; a `RETIRE_SUBTYPES = new Set(["401k","ira","roth","roth 401k","403b","457b","pension","retirement","sep ira","simple ira","thrift savings plan"])` (confirm against the live subtype list) used when `type==="investment"`.
  - `mapAccount(raw)` → `{ plaid_account_id, source:"plaid", name, type, current_value, iso_currency_code? }`. `current_value` = `raw.type === "credit" ? -(balances.current ?? 0) : (balances.current ?? 0)`. Round to 2 decimals.
  - `mapTransaction(raw)` → return **`null`** when `!raw.transaction_id`; else `{ source:"plaid", external_id, plaid_account_id, amount (raw, rounded to 2dp), iso_currency_code, date, name, merchant_name, category_primary, category_detailed, pending: Boolean(raw.pending) }`. Read `personal_finance_category.primary/detailed` (confirm field names live).
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: plaid pure mappers (amount sign + credit-liability + type lookup) (plaid)`

## Task 5: Pure transactions-sync reducer — TDD

**Files:** Create `src/lib/plaid/reducer.ts`, `src/lib/plaid/reducer.test.ts`.

The reducer is the heart of the sync, isolated as pure logic so it's exhaustively testable without a DB. It takes the mapped `added`/`modified` rows + the `removed` ids and produces a deterministic plan of **upserts** and **deletes**. `syncPlaidItem` (Task 6) just executes that plan against Supabase.

**Contract the tests pin:**
- `added` and `modified` both become **upserts** (same `(user_id, source, external_id)` key) — `modified` is not special-cased.
- `removed` ids become **deletes** by `external_id`.
- A row that appears in both `added`/`modified` AND `removed` resolves to a **delete** (removed wins — Plaid says it's gone).
- `null`-mapped rows (no `transaction_id`) are already dropped by `mapTransaction`, so the reducer's input is non-null; it still de-dupes by `external_id` keeping the last occurrence.

- [ ] **Step 1: Failing tests** in `src/lib/plaid/reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyTransactionsDelta } from "./reducer";

const tx = (id: string, amount = 1) => ({ external_id: id, source: "plaid", amount, date: "2026-06-04" });

describe("applyTransactionsDelta", () => {
  it("upserts added + modified, deletes removed", () => {
    const plan = applyTransactionsDelta({
      added: [tx("a1"), tx("a2")],
      modified: [tx("m1", 9)],
      removed: ["r1", "r2"],
    });
    expect(plan.upserts.map((r) => r.external_id)).toEqual(["a1", "a2", "m1"]);
    expect(plan.deletes).toEqual(["r1", "r2"]);
  });

  it("removed wins when an id is both upserted and removed", () => {
    const plan = applyTransactionsDelta({ added: [tx("x")], modified: [], removed: ["x"] });
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual(["x"]);
  });

  it("de-dupes upserts by external_id, keeping the last occurrence", () => {
    const plan = applyTransactionsDelta({ added: [tx("d", 1)], modified: [tx("d", 5)], removed: [] });
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].amount).toBe(5);
  });

  it("handles an empty delta", () => {
    expect(applyTransactionsDelta({ added: [], modified: [], removed: [] })).toEqual({ upserts: [], deletes: [] });
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `src/lib/plaid/reducer.ts`: build a `Map<external_id, row>` from `[...added, ...modified]` (later wins → de-dupe), then delete any key present in `removed`; return `{ upserts: [...map.values()], deletes: removed }`. Keep it generic over the row type (`<T extends { external_id: string }>`).
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: plaid transactions-sync reducer (added/modified/removed) (plaid)`

## Task 6: Plaid sync core (`syncPlaidItem` + `syncPlaid`) with the concurrency guard

**Files:** Create `src/lib/sync/plaid.ts`. (The concurrency guard lives in `src/lib/plaid/lock.ts` — built + tested in Task 7; this task imports it. **Build Task 7 before wiring the lock here, or stub `withItemSyncLock` as pass-through and wire it in Task 7.** Recommended order: do Task 7 first, then this. Either order works since the lock is a separate file.)
Mirror `src/lib/sync/calendar.ts` for the `sync_runs` / `error_events` scaffolding and passed-client discipline. **Key differences from calendar/whoop:** NO token refresh (the access token is durable), the cursor is the incremental state (not a time window), and balances + transactions arrive in one response.

**Behaviors:**
- `syncPlaidItem(client, userId, item)`:
  1. **Decrypt** the access token (`decryptToken(item.access_token)`).
  2. `transactionsSync(token, item.transactions_cursor)` — loops `has_more` internally (Task 3).
  3. **Stream A — accounts/balances (do FIRST so transaction FKs resolve):** `item.accounts.map(mapAccount)` → add `user_id` → `client.from("finance_accounts").upsert(rows, { onConflict: "user_id,plaid_account_id" })`. Then write a daily `finance_snapshots` row per Plaid account: resolve each account's internal `finance_accounts.id` (select by `(user_id, plaid_account_id)`), `upsert({ user_id, account_id, date: today, value: current_value }, { onConflict: "account_id,date" })`. **RLS ordering caution — do NOT reorder these:** the `finance_snapshots` insert must run AFTER the `finance_accounts` upsert has committed AND the internal `account_id` has been re-selected, because the snapshot insert policy checks `exists (select 1 from finance_accounts where id = account_id and user_id = auth.uid())` — and the inline backfill (Task 8) runs under the cookie client (RLS-enforced), so a snapshot written before its account row exists would be rejected by the policy.
  4. **Stream B — transactions:** `added.map(mapTransaction)` + `modified.map(mapTransaction)` (drop nulls) → feed `applyTransactionsDelta` → `upserts`: resolve `account_id` from `plaid_account_id` via a lookup map built in Stream A, add `user_id`, `client.from("transactions").upsert(rows, { onConflict: "user_id,source,external_id" })`; `deletes`: `client.from("transactions").delete().eq("user_id", userId).eq("source","plaid").in("external_id", deletes)`.
  5. **Persist the cursor LAST** (only after Streams A+B succeed): `client.from("plaid_items").update({ transactions_cursor: nextCursor, last_synced_at: now }).eq("id", item.id)`. A crash before this re-fetches the same delta on the next run rather than skipping it (idempotent upserts make the re-fetch safe). **This ordering is load-bearing — do not persist the cursor before the writes.**
  6. **Failure isolation:** wrap each stream in its own try/catch. A stream error records `error_events { user_id, provider:"plaid", severity:"error", message, context:{ stage:"syncPlaidAccounts" | "syncPlaidTransactions", count } }` (NEVER amounts/merchants/PII), sets a `partial` flag, and **keeps `status='connected'`**. Only an item-auth failure (a Plaid `ITEM_LOGIN_REQUIRED` error_code, status 400 with that code) flips `status='login_required'`. If a stream fails, **do NOT persist the cursor** (don't advance past undelivered data).
  7. Write `sync_runs { user_id, provider:"plaid", started_at, finished_at, rows_synced: accountRows+txnUpserts, status: anyStreamFailed ? "partial" : "ok", error_message }`. (`sync_runs.status ∈ {ok,partial,failed}`, `error_events.severity ∈ {info,warn,error}` — confirm against `20260527120012_create_observability.sql`.) Return `{ ok, status, accountRows, txnRows }`.
- `syncPlaid(client, userId)`: select the user's `plaid_items` (RLS/explicit `user_id`), and for each item call `withItemSyncLock(client, item.id, () => syncPlaidItem(client, userId, item))` (Task 7). Aggregate the per-item results.

- [ ] **Step 1:** Implement per above (use the PASSED client; never create one — the inline backfill passes the cookie client, the cron/webhook pass the admin client). Log counts + stage tags only.
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: plaid sync core (balances + transactions, cursor-last, isolated streams) (plaid)`

## Task 7: Concurrency guard — `withItemSyncLock` — TDD (HIGHEST-RISK ITEM)

**Files:** Create `src/lib/plaid/lock.ts`, `src/lib/plaid/lock.test.ts`.

> **Why this is its own task with its own test:** the webhook, the hourly cron, AND the inline backfill can all fire `syncPlaidItem` for the **same item** near-simultaneously. Two concurrent syncs reading the same `transactions_cursor`, then each persisting *their own* `next_cursor`, can **permanently skip a transactions delta** — silent, irreversible financial-data loss. The guard makes the cursor advance effectively serial per item. This is the single highest-risk piece of the slice.

**Approach (skip-if-recent / `syncing_at` claim):** before syncing, atomically "claim" the item by setting `syncing_at = now()` **only if** it's currently null or stale (older than a `STALE_LOCK_MS` window, so a crashed sync that never cleared the flag self-heals). If the claim fails (someone else holds a fresh lock), **skip** this run (the holder will pick up the latest cursor; a missed webhook is covered by the next cron tick anyway). Always clear `syncing_at` in a `finally`.

The pure decision is unit-tested; the DB claim is a conditional `UPDATE ... WHERE syncing_at IS NULL OR syncing_at < <stale-threshold> RETURNING id` (claim succeeded iff a row comes back — atomic at the row level, no extra advisory-lock infra needed for a single-user app).

- [ ] **Step 1: Failing tests** in `src/lib/plaid/lock.test.ts` (test the pure `shouldSkipSync` helper):

```ts
import { describe, it, expect } from "vitest";
import { shouldSkipSync, STALE_LOCK_MS } from "./lock";

describe("shouldSkipSync", () => {
  const now = 1_000_000_000_000;
  it("does NOT skip when no sync is in flight", () => {
    expect(shouldSkipSync(null, now)).toBe(false);
  });
  it("skips when a fresh sync is in flight", () => {
    const fresh = new Date(now - 5_000).toISOString(); // 5s ago
    expect(shouldSkipSync(fresh, now)).toBe(true);
  });
  it("does NOT skip when the in-flight lock is stale (crashed sync self-heals)", () => {
    const stale = new Date(now - STALE_LOCK_MS - 1).toISOString();
    expect(shouldSkipSync(stale, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `src/lib/plaid/lock.ts`:
  - `export const STALE_LOCK_MS = 5 * 60_000;` (a sync can't legitimately run longer than the 60s `maxDuration`; 5 min is a safe self-heal window).
  - `export function shouldSkipSync(syncingAt: string | null, now = Date.now()): boolean` — `false` if null or `now - Date.parse(syncingAt) >= STALE_LOCK_MS`, else `true`.
  - `export async function withItemSyncLock<T>(client, itemId, fn): Promise<T | null>` — claim via a conditional update: `update({ syncing_at: new Date().toISOString() }).eq("id", itemId).or("syncing_at.is.null,syncing_at.lt.<isoStaleThreshold>").select("id")`; if no row returned → **return `null` (skipped)**; else `try { return await fn(); } finally { client.from("plaid_items").update({ syncing_at: null }).eq("id", itemId); }`. (Use the passed client; the admin client bypasses RLS so it's scoped by `id` which is already user-owned via the prior `user_id` select.)
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: per-item sync concurrency guard (cursor-race protection) (plaid)`

## Task 8: `/api/plaid/link-token` route + Link client component + exchange action

**Files:** Create `src/app/api/plaid/link-token/route.ts`, `src/app/(app)/settings/PlaidLinkButton.tsx`; Modify `src/app/(app)/settings/_actions/connections.ts`.

- [ ] **Step 1:** Create `src/app/api/plaid/link-token/route.ts` — auth-guarded `GET` (mirror the `getCurrentUserId` guard from `src/app/api/google/connect/route.ts`): if no user → `NextResponse.redirect("/login")`; else `const link_token = await createLinkToken(userId); return Response.json({ link_token });`. (Or expose `createPlaidLinkToken()` as a server action and skip the route — pick one; the route is simpler for the `usePlaidLink` fetch.)
- [ ] **Step 1b (UPDATE-MODE plumbing — required for the RECONNECT path in Task 11):** the same `link-token` route must mint an **update-mode** link token when reconnecting an existing `login_required` item, not just fresh-connect tokens. Accept an optional `item_id` query param (e.g. `GET /api/plaid/link-token?item_id=<plaid item_id>`); when present, look up that user's `plaid_items` row (RLS/explicit `user_id`), decrypt its `access_token`, and call `createLinkToken(userId, { accessToken })` so the wrapper omits `products` and instead passes `access_token` to `/link/token/create` (Plaid update mode re-auths the same item in place). When `item_id` is absent → fresh-connect token as in Step 1. Extend `createLinkToken` in `src/lib/plaid/client.ts` (Task 3) to take an optional `{ accessToken?: string }` second arg and branch the request body accordingly. **Verify the exact update-mode request params (`access_token`, and that `products` must be omitted) against the live docs at https://plaid.com/docs/api/link/ at build — training data is stale.**
- [ ] **Step 2:** Add `exchangePlaid(publicToken: string)` to `_actions/connections.ts` (mirror the `ActionResult` shape; `"use server"`):
  - guard `getCurrentUserId`; `const { accessToken, itemId } = await exchangePublicToken(publicToken);`
  - encrypt + insert/update the item: `supabase.from("plaid_items").upsert({ user_id, item_id: itemId, access_token: encryptToken(accessToken), institution_name: <from Link metadata or null>, status: "connected", last_error: null }, { onConflict: "user_id,item_id" })`.
  - **inline backfill:** load the just-saved item row, `await syncPlaidItem(supabase, userId, item)` (cursor null → full ~90-day history). Wrap in try/catch — a backfill hiccup must still leave the item connected so the cron picks it up.
  - `revalidatePath("/settings")`, `revalidatePath("/finance")`, `revalidatePath("/dashboard")`; return `{ ok: true }`.
- [ ] **Step 3:** Create `src/app/(app)/settings/PlaidLinkButton.tsx` (`"use client"`) — uses `react-plaid-link`'s `usePlaidLink` (or the vanilla fallback from Task 2):
  - on mount/click, `fetch("/api/plaid/link-token")` → `{ link_token }`; pass `token` to `usePlaidLink({ token, onSuccess: (public_token) => startTransition(() => exchangePlaid(public_token).then(() => router.refresh())) })`; render a "Connect" button that calls `open()` when `ready`.
  - Show a "Connecting…" state during the exchange. Keep it under 150 lines.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm build` compiles the route + client component. **Commit** — `feat: plaid link-token route + Link button + exchange action (plaid)`

## Task 9: `/api/plaid/webhook` route + ES256 verification — TDD the verifier

**Files:** Create `src/lib/plaid/verify.ts`, `src/lib/plaid/verify.test.ts`, `src/app/api/plaid/webhook/route.ts`.
**Docs (READ FIRST):** https://plaid.com/docs/api/webhooks/webhook-verification/ — the `Plaid-Verification` header is an **ES256 JWT** whose header carries a `kid`; fetch the JWK via `/webhook_verification_key/get`; the JWT body has a `request_body_sha256` claim and an `iat`; verify the signature, the `iat` freshness (< 5 min), and a **constant-time** SHA-256 comparison of the raw request body against the claim.

> **Security contract:** EVERY webhook request is rejected **401 with no DB write** unless all three checks pass (valid ES256 signature, fresh `iat`, matching body hash). Never log raw financial payloads — counts/stage tags only.

- [ ] **Step 1: Failing tests** in `src/lib/plaid/verify.test.ts` (mock the key — generate an ES256 keypair in-test with `jose`):

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, exportJWK, SignJWT, calculateJwkThumbprint } from "jose";
import { createHash } from "node:crypto";
import { verifyWebhook } from "./verify";

let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
const KID = "test-kid";

async function signed(body: string, opts: { iat?: number; bodyHash?: string } = {}) {
  const hash = opts.bodyHash ?? createHash("sha256").update(body).digest("hex");
  return new SignJWT({ request_body_sha256: hash })
    .setProtectedHeader({ alg: "ES256", kid: KID })
    .setIssuedAt(opts.iat ?? Math.floor(Date.now() / 1000))
    .sign(privateKey);
}

beforeAll(async () => {
  const kp = await generateKeyPair("ES256");
  privateKey = kp.privateKey;
  publicJwk = { ...(await exportJWK(kp.publicKey)), kid: KID, alg: "ES256" };
});

const getKey = async (kid: string) => (kid === KID ? publicJwk : null);

describe("verifyWebhook", () => {
  it("accepts a correctly-signed, fresh, body-matching request", async () => {
    const body = JSON.stringify({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" });
    const jwt = await signed(body);
    await expect(verifyWebhook({ headerJwt: jwt, rawBody: body, getKey })).resolves.toBe(true);
  });

  it("rejects a tampered body (hash mismatch)", async () => {
    const jwt = await signed('{"a":1}');
    await expect(verifyWebhook({ headerJwt: jwt, rawBody: '{"a":2}', getKey })).resolves.toBe(false);
  });

  it("rejects a stale iat (> 5 min old)", async () => {
    const body = "{}";
    const jwt = await signed(body, { iat: Math.floor(Date.now() / 1000) - 6 * 60 });
    await expect(verifyWebhook({ headerJwt: jwt, rawBody: body, getKey })).resolves.toBe(false);
  });

  it("rejects when the kid is unknown", async () => {
    const jwt = await new SignJWT({ request_body_sha256: "x" })
      .setProtectedHeader({ alg: "ES256", kid: "other" }).setIssuedAt().sign(privateKey);
    await expect(verifyWebhook({ headerJwt: jwt, rawBody: "{}", getKey })).resolves.toBe(false);
  });

  it("rejects a garbage header", async () => {
    await expect(verifyWebhook({ headerJwt: "not-a-jwt", rawBody: "{}", getKey })).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `src/lib/plaid/verify.ts`:
  - `verifyWebhook({ headerJwt, rawBody, getKey })`: decode the JWT header for `kid` (`jose.decodeProtectedHeader`); `const jwk = await getKey(kid)`; if none → `false`. Import it (`jose.importJWK(jwk, "ES256")`) and `jose.jwtVerify(headerJwt, key, { algorithms: ["ES256"] })` — catch → `false`. Check `payload.iat` is within 5 min of now → else `false`. Compute `createHash("sha256").update(rawBody).digest("hex")` and **constant-time compare** (`crypto.timingSafeEqual` over equal-length buffers) against `payload.request_body_sha256` → return the boolean. Wrap the whole thing so ANY throw returns `false` (never 500 on a malformed attack request).
  - `getKey` is injected so the test mocks it; the route passes a real one backed by `getWebhookVerificationKey` (Task 3) with a tiny in-memory `kid→jwk` cache.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** Create `src/app/api/plaid/webhook/route.ts` (`export const maxDuration = 60;`):
  - `const rawBody = await request.text();` (read RAW — needed for the hash). `const headerJwt = request.headers.get("plaid-verification");`
  - `if (!headerJwt || !(await verifyWebhook({ headerJwt, rawBody, getKey: cachedGetKey }))) return new Response("Unauthorized", { status: 401 });` — **no DB write before this passes.**
  - parse `rawBody`; on `webhook_type === "TRANSACTIONS"` && code ∈ `{SYNC_UPDATES_AVAILABLE, INITIAL_UPDATE, HISTORICAL_UPDATE, TRANSACTIONS_REMOVED}` → look up `plaid_items` by `item_id` via the **admin client** (no user cookie), then `withItemSyncLock(admin, item.id, () => syncPlaidItem(admin, item.user_id, item))`.
  - on `webhook_type === "ITEM"` && code `ERROR`/`LOGIN_REPAIRED`/`PENDING_DISCONNECT` etc. → if it's `ITEM_LOGIN_REQUIRED` (in `error.error_code` or the code) set `plaid_items.status='login_required'`.
  - ignore everything else (e.g. `RECURRING_TRANSACTIONS_UPDATE`). Return `200 { ok: true }`. **Log counts/stage tags only — never the payload.**
- [ ] **Step 6: Verify** `npx tsc --noEmit`; `pnpm build`. **Commit** — `feat: plaid webhook (ES256 verify, 401-no-write) + sync trigger (plaid)`

## Task 10: `/api/plaid/sync` cron route + `vercel.json`

**Files:** Create `src/app/api/plaid/sync/route.ts` (`export const maxDuration = 60;`); Modify `vercel.json`.
**Mirror `src/app/api/google-calendar/sync/route.ts`:** copy its constant-time `authMatches` `CRON_SECRET` check verbatim; use the admin client; select `plaid_items` where `status='connected'`; for each, `withItemSyncLock(admin, item.id, () => syncPlaidItem(admin, item.user_id, item))`; count ok vs failed (a skipped lock counts as neither failure nor success — treat `null` as "skipped").

- [ ] **Step 1:** Implement the route (belt-and-suspenders for missed webhooks; hourly).
- [ ] **Step 2:** In `vercel.json`, add a third cron entry (hourly), preserving the existing two:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [
  { "path": "/api/google-calendar/sync", "schedule": "*/5 * * * *" },
  { "path": "/api/whoop/sync", "schedule": "0 * * * *" },
  { "path": "/api/plaid/sync", "schedule": "0 * * * *" }
] }
```

(If the live `vercel.json` doesn't yet contain the whoop entry, add Plaid alongside whatever is there — don't drop existing crons.)

- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm build`; route table shows `/api/plaid/sync`. **Commit** — `feat: plaid hourly cron fallback + vercel.json (plaid)`

## Task 11: Settings — dedicated Plaid connection row + disconnect/sync actions

**Files:** Create `src/app/(app)/settings/PlaidConnectionRow.tsx`; Modify `src/app/(app)/settings/_actions/connections.ts`, `src/app/(app)/settings/ConnectionsCard.tsx`.

> **Why a dedicated row (open item resolved):** the redirect-based `GoogleConnectionRow` (and any generalized `ProviderConnectionRow`) assumes an `<a href>` connect path. Plaid connects via the Link **modal**, not a redirect, so it needs its own small row that embeds `PlaidLinkButton` instead of an anchor. Status is the **aggregate** of `plaid_items`.

- [ ] **Step 1:** Add to `_actions/connections.ts` (mirror `disconnectGoogle`/`syncGoogleNow`):
  - `disconnectPlaid()`: for each of the user's `plaid_items`, `await removeItem(decryptToken(item.access_token))` (revoke Plaid access first — best-effort, swallow per-item errors so one stuck item doesn't block disconnect), then `delete from plaid_items where user_id`, **and** `delete from transactions where user_id and source='plaid'` and `delete from finance_accounts where user_id and source='plaid'` (clean disconnect — the spec recommends removing Plaid-owned rows; manual rows untouched). `revalidatePath("/settings","/finance","/dashboard")`.
  - `syncPlaidNow()`: `await syncPlaid(supabase, userId)`; revalidate `/finance`, `/dashboard`, `/settings`.
  - `createPlaidLinkToken()` (only if you chose the action route in Task 8): guard user, return `{ ok: true, token }` / `{ ok:false, error }`.
- [ ] **Step 2:** Create `PlaidConnectionRow.tsx` — a client component modeled on `GoogleConnectionRow.tsx` (same grid/`META` colour map: `connected→CONNECTED`, `login_required→RECONNECT honey`, `error→ERROR rust`), but:
  - takes `{ status: string | null; syncedLabel: string | null; anyLoginRequired: boolean }` (the aggregate computed server-side in Step 3).
  - when NOT connected → render `<PlaidLinkButton mode="connect" />` (opens Link); when `login_required` → render `<PlaidLinkButton mode="update" />` (Link **update mode** re-auths the same item in place — pass the item context so the link-token route can mint an update-mode token; confirm update-mode token params against the live docs); when connected → a Disconnect button calling `disconnectPlaid` + a post-connect `syncPlaidNow` trigger (mirror Google's `?connected` effect, keyed to Plaid).
  - icon `PL`, label `Plaid`, sub `FINANCE`. Keep under 150 lines.
- [ ] **Step 3:** In `ConnectionsCard.tsx`, remove the static `Plaid` placeholder from `PENDING_PROVIDERS`; load the user's `plaid_items` (`select status, last_synced_at, last_error`); compute the aggregate status (`any status==='error' → 'error'`; else `any 'login_required' → 'login_required'`; else `any row → 'connected'`; else `null`), the freshest `last_synced_at` → `staleAgeLabel`, and `anyLoginRequired`; render `<PlaidConnectionRow .../>` next to the Google + Whoop rows. Keep Health Auto Export static.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: live plaid connection row + disconnect/sync actions (plaid)`

## Task 12: Finance Transactions section

**Files:** Create `src/components/modules/finance/TransactionsList.tsx`; Modify `src/app/(app)/finance/page.tsx`.

- [ ] **Step 1:** Create `TransactionsList.tsx` — a presentational list taking `{ transactions, timeZone }`. Each row: `merchant_name || name` (truncated), date formatted via `Intl.DateTimeFormat` in `timeZone` (mirror `CalendarList.tsx`'s `formatWhen` **including its invalid-tz → UTC try/catch fallback**), the amount formatted with sign + colour (outflow positive → show as a debit; inflow negative → show as a credit/accent — pick the convention and a small `fmtSignedUSD` helper; reuse `fmtUSD` from `@/lib/format`), `category_primary` as a mono sub-label, and a `PENDING` chip when `pending`. Mirror `CalendarList`/`StatRow` styling. Keep under 150 lines.
- [ ] **Step 2:** In `finance/page.tsx`, get the timezone the same way the other modules do (check the existing page/`CalendarCard` pattern — e.g. `getOperator()` → `operator?.timezone?.trim() || "UTC"`; do NOT add a raw `profiles` query). Load recent transactions via the cookie client (RLS): `supabase.from("transactions").select("date,name,merchant_name,amount,category_primary,pending,created_at").order("date", { ascending:false }).order("created_at", { ascending:false }).limit(25)`. **The secondary `created_at desc` sort is required as a tie-break:** `date` is day-granularity, so many transactions share a date and a `date`-only sort is non-deterministic — the same-day rows would shuffle across renders. The secondary sort makes the list order stable. (Selecting `created_at` is what makes it available as the tie-break column.) Render a new `Card num="04" title="TRANSACTIONS" meta="RECENT"` with `<TransactionsList transactions={rows} timeZone={timeZone} />` (or `<EmptyState caption="No transactions yet" />`). **Do NOT change the net-worth / sparkline / allocation cards** — they already read `finance_accounts` + `finance_snapshots` and pick up Plaid balances automatically.
- [ ] **Step 3: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: finance transactions section (plaid) (plaid)`

## Task 13: Playwright + full verification gate (incl. unsigned-webhook 401 + Google/Whoop regression)

**Files:** Create `tests/e2e/plaid.spec.ts`.
**Reminder (project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

- [ ] **Step 1:** Create `tests/e2e/plaid.spec.ts` (mirror `tests/e2e/connections.spec.ts`):
  - **Unauthenticated `/api/plaid/link-token` redirects to `/login`** (route guard; do NOT build an auth fixture or hit Plaid).
  - **Unsigned-webhook 401:** `POST /api/plaid/webhook` with a bogus/missing `Plaid-Verification` header returns **401** and writes nothing. Use Playwright's `request.post` (this route is NOT session-gated, so it's directly testable):

```ts
import { test, expect } from "@playwright/test";

test.describe("plaid — unauthenticated / unsigned", () => {
  test("unauthenticated /api/plaid/link-token redirects to /login", async ({ page }) => {
    await page.goto("/api/plaid/link-token");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unsigned webhook is rejected 401", async ({ request }) => {
    const res = await request.post("/api/plaid/webhook", {
      data: { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" },
    });
    expect(res.status()).toBe(401);
  });

  test("webhook with a bogus Plaid-Verification header is rejected 401", async ({ request }) => {
    const res = await request.post("/api/plaid/webhook", {
      headers: { "Plaid-Verification": "not-a-real-jwt" },
      data: { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" },
    });
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run the full gate:**
  - `pnpm test` → all unit pass (crypto, store, google calendar, stale, whoop health/workouts, **plaid map + reducer + verify + lock**)
  - `npx tsc --noEmit` → 0 errors
  - `pnpm lint` → 0 errors
  - `pnpm build` → succeeds; route table shows `/api/plaid/link-token`, `/api/plaid/webhook`, `/api/plaid/sync`
  - `pnpm test:e2e` → green (incl. the two 401 webhook assertions)
- [ ] **Step 3: Regression check (CODE-level, automatable now):** confirm the existing Google + Whoop unit tests pass unchanged; `GoogleConnectionRow.tsx` is untouched; the Google + Whoop cron entries are still present in `vercel.json` (you only ADDED the Plaid entry); the `integrations` store is unchanged (Plaid uses `plaid_items`, not `integrations`). The live Google/Whoop runtime check is part of manual acceptance.
- [ ] **Step 4: Commit** — `test: e2e plaid (route guards + unsigned-webhook 401) + green full gate (plaid)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After Max's pre-flight + deploy with `PLAID_*` env vars set (Sandbox), and `PLAID_ENV=sandbox`:

1. Sign in → **Settings → Connections → Connect** on Plaid → the **Plaid Link modal** opens → choose a Sandbox institution (e.g. "First Platypus Bank") → Sandbox credentials `user_good` / `pass_good` → approve.
2. Returns to Settings showing **Plaid · CONNECTED**, auto-syncing.
3. **Finance page:** the linked accounts appear in the **Accounts list** (source `plaid`) and the **net-worth total + 30-day sparkline include them**; the new **Transactions section** shows real categorized transactions (merchant, amount, category, PENDING chips).
4. **Manual-coexistence contract:** with a manually-entered account already present, confirm the **manual account is untouched** (not overwritten, not deleted) while Plaid accounts appear as additional rows and net worth sums both.
5. **Webhook freshness:** trigger a Sandbox transactions update (the dashboard's `/sandbox/item/fire_webhook` or a new-transaction simulation) → confirm a **webhook-triggered** sync lands new data.
6. **Cron fallback:** wait ≤1h (or manually invoke the cron route with the `CRON_SECRET`) → confirm a sync runs.
7. **Idempotency:** re-run a sync (or re-fire the same delta) → **no duplicate transactions**, balances stable.
8. **Unsigned webhook 401:** confirm (e.g. `curl -X POST .../api/plaid/webhook` with no `Plaid-Verification`) returns **401** and writes nothing.
9. **Re-auth path:** simulate `ITEM_LOGIN_REQUIRED` (Sandbox `/sandbox/item/reset_login`) → confirm the row shows **RECONNECT** and Link **update mode** restores it.
10. **Disconnect:** confirm → Plaid accounts + transactions are removed, the manual account remains, and the row returns to **NOT CONNECTED**.
11. **Google + Whoop regression:** confirm both still render + sync (Calendar still refreshes its Google token; Whoop still rotates its refresh token) — the Plaid slice touched neither.

Passing on Sandbox = the slice is functionally done.

**Production milestone (after Plaid approves Production access):** copy the Production `PLAID_SECRET`, set `PLAID_ENV=production` + the Production secret in Vercel, redeploy, and **re-link a real institution** (Sandbox items don't carry over). Re-run steps 1–4 + 10 against a real bank to confirm production credentials + institution coverage. This is the final acceptance.

## Notes / deviations

- **No refresh machinery — the inverse of Whoop.** The Plaid `access_token` is durable and non-rotating, so the entire token-refresh/expiry path from the calendar/whoop sync cores is **absent here by design**. The item-store is `plaid_items` (item-grained, encrypted token + cursor + status), NOT the single-row-per-provider `integrations` table — Plaid's one-item→many-accounts model doesn't fit `integrations`.
- **Two idempotency keys:** balances upsert on `(user_id, plaid_account_id)` (partial-unique, NULLs distinct → manual rows never clobbered); transactions upsert on `(user_id, source, external_id)` (drop null-`transaction_id` rows). Daily snapshots upsert on the existing `(account_id, date)`.
- **Cursor-last ordering is load-bearing** and is the finance analogue of Whoop's write-before-use: never advance `transactions_cursor` until the dependent account + transaction writes succeed, so a crash re-fetches the same delta instead of skipping it.
- **Concurrency guard (Task 7)** is the mitigation for the spec's highest-risk open item (webhook + cron + inline backfill racing the cursor) — a per-item `syncing_at` claim with a stale-lock self-heal, unit-tested via the pure `shouldSkipSync`.
- **TDD'd pure units:** `mapAccount`/`mapTransaction` + `ACCOUNT_TYPE_MAP` (the amount-sign + credit-liability numeric mappings), `applyTransactionsDelta` (the added/modified/removed reducer), `verifyWebhook` (ES256 + iat + constant-time body-hash, mocked key), `shouldSkipSync` (the lock decision). Routes + the Link client component are covered by e2e + manual sandbox acceptance.
- **Dependencies (Task 2 decision):** official `plaid` Node SDK (typed, server-only), `react-plaid-link` (client — React 19/Next 16 compatibility is a HARD GATE with a documented vanilla-script fallback), `jose` (ES256 JWT verify). `react-plaid-link` is the project's first genuinely-new client-side dependency.
- **Heightened privacy:** no financial PII (amounts, merchants, account/routing numbers, raw payloads) is ever logged — `error_events`/`sync_runs`/`console` carry counts + stage tags only. RLS is own-row-only on both new tables; the webhook/cron admin-client paths scope every read/write by `user_id`.
- **Live re-verification at build:** the mappers/reducer/verifier pin the *tested* contract (sign, precision, precedence, the three security checks); the actual Plaid field names, account `subtype` list, `personal_finance_category` taxonomy, SDK method names, and update-mode token params must be confirmed against https://plaid.com/docs before locking — training data is stale.
- **Cost:** acknowledged, not optimized — Sandbox/Trial free; in Production, Transactions + Balance are billable pay-as-you-go, scaling with items + volume (minimal for single-user).
- **Build vs production split:** every task above is built + tested on Sandbox; production approval runs in parallel (Pre-flight) and is the final manual milestone.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-personal-os-plaid.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
2. **Inline Execution** — execute tasks in this session with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

Which approach?
