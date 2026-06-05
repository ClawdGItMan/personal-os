# Apple Health Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Fresh session. The Whoop slice is merged and supplies the health_snapshots partial-merge + workouts upsert you reuse. This is NOT OAuth — it ingests JSON pushed by the Health Auto Export iOS app to an inbound endpoint, authed by a per-user ingest token. Before locking the parser, capture ONE real HAE push and verify field names/units (training data is stale).**
>
> **Read this whole plan + the spec before starting.** The Google (1B.1a) and Whoop (1B.2) slices are live; do NOT break them (there's a regression gate at the end). This slice mirrors Whoop's *data-landing* layer (partial-merge metrics + workouts upsert + sync_runs/error_events observability) and **deliberately diverges on the connection model**: Apple Health is inbound push, so there is no OAuth token store, no connect/callback redirect, and no Vercel cron.

**Goal:** Max installs the Health Auto Export iOS app once, generates an ingest token in Settings, and points a HAE "REST API" Automation at a Personal OS endpoint. His iPhone then *pushes* six Apple Health metrics + Apple Watch workouts on a schedule. The dashboard Health view fills the gaps Whoop leaves (steps, body weight, and RHR/HRV/sleep on Whoop-less days) and the Train Activity section shows Apple workouts alongside Whoop's — all source-tagged `apple_health`.

**Architecture:** A single inbound, token-authed route (`POST /api/apple-health/ingest`) accepts HAE's JSON. The route resolves the user from the token (no session cookie), verifies the token's secret with a constant-time hash compare *before* parsing the body, then runs two reused writers: the **health_snapshots partial-merge** (only Apple-owned columns present → Whoop/manual columns survive untouched) and the **workouts upsert** (`source='apple_health'`, deterministic `external_id`). Pure logic — payload parser, metric mapper, workout mapper, token hashing — is TDD'd; the route + Settings token row are covered by e2e + manual acceptance. No new env vars, no cron, no token refresh.

**Tech Stack:** Next.js 16 (App Router route handlers, Node runtime), React 19 server components, Supabase (`@supabase/ssr` cookie client for Settings + `@supabase/supabase-js` service-role admin client for the public ingest route), Node `crypto` (SHA-256 + `timingSafeEqual` for token hashing — NOT the AES encrypt path), Zod, Vitest, Playwright. No Vercel Cron (HAE is the scheduler).

**Spec:** `docs/superpowers/specs/2026-06-05-personal-os-apple-health-design.md` (read it — it has the merge policy, the token-auth model, the abuse-protection rationale, and the resolved open items).

**Foundation templates (read these first — you will mirror them):**
- `src/lib/sync/whoop.ts` — Whoop sync core: the **health_snapshots partial-merge upsert** + the **workouts upsert** you reuse (Tasks 0 + 6). **NOTE:** at plan-authoring time this file was not yet on disk; the merged Whoop slice supplies it. **Task 0 asserts the reusable writers actually exist and factors them out if they were inlined in the sync route.**
- `src/lib/sync/calendar.ts` — sync_runs/error_events logging shape + best-effort error swallowing (Task 6 mirrors `writeSyncRun` + the catch block).
- `src/app/api/google-calendar/sync/route.ts` — the `authMatches` **`timingSafeEqual` length-guard** pattern you adapt for token compare (Task 1) and the service-role admin route shape (Task 6).
- `src/lib/crypto/tokens.ts` — encrypt/decrypt ONLY; **you add `hashToken`/`compareToken` here in Task 1** (the ingest token is hashed, never decrypted).
- `src/lib/supabase/admin.ts` — `createAdminClient()` (reused as-is by the ingest route).
- `src/lib/whoop/health.ts` — the `mapHealthDay` "build a partial row, omit absent keys" contract you mirror for `mapMetricsToDays` (Task 3).
- `src/app/(app)/settings/GoogleConnectionRow.tsx`, `ConnectionsCard.tsx`, `_actions/connections.ts` — the Settings connection-row + actions you mirror (Tasks 5–6); `src/lib/sync/stale.ts` (`staleAgeLabel`), `src/lib/auth.ts` (`getCurrentUserId`), `src/lib/action-result.ts` (`ActionResult`).
- Migrations (no migration needed this slice — both tables already allow `apple_health`): `supabase/migrations/20260527120007_create_health_snapshots.sql` (allows `source='apple_health'`, `unique(user_id,date)`), `supabase/migrations/20260605120000_create_workouts.sql` (allows `source='apple_health'`, `unique(user_id,source,external_id)`), `supabase/migrations/20260527120001_create_integrations_and_agent_messages.sql` (`integrations.metadata jsonb`, `unique(user_id,provider)` — the ingest-token hash lives in `metadata`).

---

## Pre-flight — Max's one-time Health Auto Export setup (BLOCKS the manual acceptance only; every code task can be built + unit/e2e-tested without it)

Provide Max this click-by-click. There is **no developer account, no API review, no env var** — the only gate is the App Store purchase. (Reference: [HAE REST API docs](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/) — label wording may differ by app version; confirm against the installed app.)

1. **Install "Health Auto Export — JSON+CSV"** (by HealthyApps / Lybron) from the iOS App Store and grant it Apple Health read access. **It's a paid app** — purchase it once.
2. In **Personal OS → Settings → Connections → Apple Health → "Generate token"**: copy the displayed **ingest URL** (`https://personal-os-azure-eight.vercel.app/api/apple-health/ingest`) and the **token** (shown once — copy now; you can regenerate if lost).
3. In **HAE → Automations → new "REST API" Automation:**
   - **URL:** the ingest URL above. **Format:** JSON.
   - **Headers → Add Header:** key `Authorization`, value `Bearer <paste-the-token>`.
   - **Health Metrics → select exactly:** Step Count, Active Energy, Resting Heart Rate, Heart Rate Variability, Sleep Analysis, Body Mass (Weight). Everything else off.
   - **Workouts:** enable.
   - **Aggregation:** "Summarize Data" / Time Grouping = **Daily**.
   - **Batch Requests:** ON (keeps each POST under the body cap; the partial-merge handles the split transparently).
   - **Schedule:** hourly, date range left at default (previous day + current day) so each push keeps today fresh.
4. **Initial backfill:** run a manual export once over a wider range (e.g. previous 7–30 days) so the dashboard has history. With Batch Requests ON this arrives as several idempotent POSTs.

> **BUILD-TIME EMPIRICAL CAPTURE (highest priority, BLOCKS Task 2's mapper field-extraction):** the spec pins the *contract* (rounding, omit-absent-keys, kcal/kJ, lb/kg, deterministic id, local-date keying — all unit-tested) but HAE publishes no canonical `name`→identifier table. Before locking the parser/mappers, **capture ONE real HAE push** (HAE's "preview JSON" / manual export, or a single live POST logged with health values redacted) and confirm: the exact lowercase snake_case metric `name` strings + `units` for our six metrics, the workout field nesting (`heartRate.avg.qty`, `activeEnergyBurned`/`totalEnergy`, energy unit kcal vs kJ, distance unit), the timestamp format (`yyyy-MM-dd HH:mm:ss Z`), whether the workout `id` is durable across re-pushes, and whether the sleep datum exposes `asleep` vs `totalSleep`. Tasks 2–4 say where to wire each. **This mirrors how the Whoop plan defers field names to a build-time docs check.**

---

## File structure

**Create:**
- `src/lib/crypto/tokens.ts` — **MODIFY**: add `hashToken` / `compareToken` (see below).
- `src/lib/crypto/tokens.test.ts` — **MODIFY**: add hash/compare tests.
- `src/lib/apple-health/ingest-token.ts` — token mint/format/parse helpers (`mintIngestToken`, `splitIngestToken`) — pure, tested.
- `src/lib/apple-health/ingest-token.test.ts`
- `src/lib/apple-health/parser.ts` — Zod schema + `parseHaePayload` (tolerant of extra arrays + batched subsets + numeric-string coercion).
- `src/lib/apple-health/parser.test.ts`
- `src/lib/apple-health/health.ts` — `mapMetricsToDays` (HAE metrics → partial `health_snapshots` rows, per-day, omit-absent-keys).
- `src/lib/apple-health/health.test.ts`
- `src/lib/apple-health/workouts.ts` — `mapWorkout` (HAE workout → `workouts` row or `null`) + deterministic `external_id` synthesis.
- `src/lib/apple-health/workouts.test.ts`
- `src/lib/sync/apple-health.ts` — `ingestAppleHealth(client, userId, payload)`: two writers (partial-merge metrics + workouts upsert), isolated failures, sync_runs/error_events logging. **Reuses the writers factored out in Task 0.**
- `src/app/api/apple-health/ingest/route.ts` — the public, token-authed inbound route.
- `src/app/(app)/settings/AppleHealthConnectionRow.tsx` — non-OAuth "Generate token / Show setup" row (NOT the OAuth `ProviderConnectionRow`).
- `tests/e2e/apple-health.spec.ts`

**Modify:**
- `src/lib/sync/whoop.ts` — **only if Task 0 finds the writers inlined**: factor the health_snapshots partial-merge + workouts upsert into shared helpers, then call them. If they're already shared helpers, no change.
- `src/app/(app)/settings/_actions/connections.ts` — add `regenerateAppleHealthToken`, `disconnectAppleHealth`.
- `src/app/(app)/settings/ConnectionsCard.tsx` — render the live Apple Health row, replacing the static `Health Auto Export` placeholder.

**Verify-only (likely no change):**
- `src/app/(app)/health/page.tsx` — already renders steps/weight/sleep/HRV/RHR from the latest `health_snapshots` row.
- `src/app/(app)/train/page.tsx` — already renders an Activity section from `workouts` (added by the Whoop slice); Apple workouts appear there automatically by source tag.

**No migration** — `health_snapshots.source` and `workouts.source` already allow `'apple_health'`; the token hash lives in the existing `integrations.metadata` jsonb.

---

## Task 0: Dependency assertion — confirm/factor out the reusable health_snapshots + workouts writers

**Files:** Read `src/lib/sync/whoop.ts` (+ `src/app/api/whoop/sync/route.ts`, `src/app/api/whoop/callback/route.ts` if the upsert was inlined there); possibly Modify `src/lib/sync/whoop.ts`.

**Why FIRST (reviewer-flagged, load-bearing):** this slice's whole value is reusing Whoop's landing layer. But a writer that lives *inline inside Whoop's sync function* is not reusable from a different entry point. **Do NOT assume a shared helper exists** — verify, and factor it out if it doesn't. (At plan-authoring time `src/lib/sync/whoop.ts` was not yet on disk; the merged Whoop slice supplies it — confirm its actual shape, don't trust this plan's guess.)

- [ ] **Step 1: Read** `src/lib/sync/whoop.ts`. Find where it writes `health_snapshots` (the partial merge-upsert `onConflict: "user_id,date"`) and `workouts` (`onConflict: "user_id,source,external_id"`).
- [ ] **Step 2: Decide.** Two cases:
  - **(a) A reusable helper already exists** (e.g. an exported `upsertHealthSnapshots(client, rows)` / `upsertWorkouts(client, rows)` taking already-mapped rows): record its name + signature here, reuse it verbatim in Task 6. No edit.
  - **(b) The upsert is inlined** inside `syncWhoop` (or the route): **factor it out** into two small exported functions in `src/lib/sync/whoop.ts` (or a shared `src/lib/sync/health-writers.ts` — pick one; co-locating in `whoop.ts` keeps the diff small) with these contracts:
    ```ts
    /** Partial column-merge: each row carries ONLY user_id, date, source, and
     *  the present metric columns. ON CONFLICT DO UPDATE sets only supplied
     *  columns → other sources' columns survive untouched. */
    export async function upsertHealthSnapshots(
      client: Client, rows: Array<Record<string, unknown>>,
    ): Promise<void>; // upsert onConflict "user_id,date"; no-op when rows.length === 0

    /** Single-source-owned rows; blind upsert. Caller drops null external_id. */
    export async function upsertWorkouts(
      client: Client, rows: Array<Record<string, unknown>>,
    ): Promise<void>; // upsert onConflict "user_id,source,external_id"; no-op when empty
    ```
    Then change `syncWhoop` to call them (behavior must be byte-for-byte identical — same `onConflict`, same no-op-on-empty).
- [ ] **Step 3: Verify** `npx tsc --noEmit` clean; `pnpm test` — the existing Whoop unit tests (`whoop/health.test.ts`, `whoop/workouts.test.ts`, store) still pass. **This is the first leg of the Whoop regression gate** — if factoring changed any behavior, stop and fix.
- [ ] **Step 4: Commit** — `refactor: factor reusable health_snapshots + workouts upsert helpers (apple-health prep)` (skip the commit if case (a) — nothing changed).

## Task 1: Token hashing helpers (`hashToken` / `compareToken`) — TDD

**Files:** Modify `src/lib/crypto/tokens.ts`, `src/lib/crypto/tokens.test.ts`.

**Why a NEW helper (reviewer-flagged):** `tokens.ts` today has only AES encrypt/decrypt — wrong tool for an ingest token we only ever *compare*, never decrypt. Add SHA-256 hashing + a constant-time compare. **Crucially, compare the fixed-length 32-byte digests, not the raw tokens** — so there's no length-leak and `timingSafeEqual` never throws on a length mismatch (it throws when its two buffers differ in length; digests are always 32 bytes, so it's safe). This generalizes the `authMatches` pattern in `src/app/api/google-calendar/sync/route.ts` (which guards length before `timingSafeEqual`); hashing first removes the guard's branch entirely.

- [ ] **Step 1: Failing tests** in `src/lib/crypto/tokens.test.ts` (keep the existing encrypt/decrypt tests):

```ts
import { hashToken, compareToken } from "./tokens";

describe("token hashing", () => {
  it("hashToken is deterministic and hex-encoded sha256 (64 hex chars)", () => {
    const h = hashToken("secret-abc");
    expect(h).toBe(hashToken("secret-abc"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it("compareToken returns true for the matching secret, false otherwise", () => {
    const stored = hashToken("secret-abc");
    expect(compareToken("secret-abc", stored)).toBe(true);
    expect(compareToken("secret-xyz", stored)).toBe(false);
  });
  it("compareToken does NOT throw on a wrong-length presented token (digests are fixed length)", () => {
    const stored = hashToken("secret-abc");
    expect(() => compareToken("", stored)).not.toThrow();
    expect(compareToken("", stored)).toBe(false);
  });
  it("compareToken returns false for a malformed stored hash without throwing", () => {
    expect(() => compareToken("secret-abc", "not-a-hash")).not.toThrow();
    expect(compareToken("secret-abc", "not-a-hash")).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/crypto/tokens.test.ts` (FAIL: `hashToken` not exported).
- [ ] **Step 3: Implement** in `src/lib/crypto/tokens.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 of a secret, hex-encoded. Deterministic — used to store/compare the
 *  ingest token. We never need the plaintext back, so this is a hash, not the
 *  AES encrypt path above. */
export function hashToken(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time compare of a presented secret against a stored sha256 hex hash.
 *  Hashes the presented secret first, so both sides are fixed-length 32-byte
 *  digests — timingSafeEqual never sees a length mismatch (no throw, no length
 *  leak). Returns false (never throws) on a malformed stored hash. */
export function compareToken(presentedSecret: string, storedHashHex: string): boolean {
  let storedBuf: Buffer;
  try {
    storedBuf = Buffer.from(storedHashHex, "hex");
  } catch {
    return false;
  }
  if (storedBuf.length !== 32) return false; // malformed stored hash
  const presentedBuf = createHash("sha256").update(presentedSecret, "utf8").digest();
  return timingSafeEqual(presentedBuf, storedBuf);
}
```

- [ ] **Step 4: Run → pass** — `npx vitest run src/lib/crypto/tokens.test.ts`. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat: sha256 hashToken/compareToken for ingest auth (apple-health)`

## Task 2: Ingest token format helpers (`mintIngestToken` / `splitIngestToken`) — TDD

**Files:** Create `src/lib/apple-health/ingest-token.ts`, `src/lib/apple-health/ingest-token.test.ts`.

**Token format (resolves the user without a session):** `<userId>.<secret>` where `secret = randomBytes(32).toString("base64url")`. The route splits on the **first** `.` (a base64url secret never contains `.`, but a UUID userId never does either — split on the first dot is unambiguous). We store only `hashToken(secret)` in `integrations.metadata`; the userId half is just an indexed lookup key — possession of the secret is what authorizes.

- [ ] **Step 1: Failing tests** in `ingest-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mintIngestToken, splitIngestToken } from "./ingest-token";

describe("mintIngestToken", () => {
  it("returns { token, secret, secretHash } with token = `${userId}.${secret}`", () => {
    const { token, secret, secretHash } = mintIngestToken("11111111-1111-1111-1111-111111111111");
    expect(token).toBe(`11111111-1111-1111-1111-111111111111.${secret}`);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{20,}$/); // base64url, no padding
    expect(secretHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("mints a different secret each call", () => {
    const a = mintIngestToken("u1"); const b = mintIngestToken("u1");
    expect(a.secret).not.toBe(b.secret);
  });
});

describe("splitIngestToken", () => {
  it("splits on the FIRST dot into { userId, secret }", () => {
    expect(splitIngestToken("u1.abc.def")).toEqual({ userId: "u1", secret: "abc.def" });
  });
  it("returns null for a token with no dot or empty halves", () => {
    expect(splitIngestToken("nodot")).toBeNull();
    expect(splitIngestToken(".secret")).toBeNull();
    expect(splitIngestToken("user.")).toBeNull();
    expect(splitIngestToken("")).toBeNull();
  });
  it("strips a leading 'Bearer ' so the route can pass the raw header value", () => {
    expect(splitIngestToken("Bearer u1.secret")).toEqual({ userId: "u1", secret: "secret" });
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `ingest-token.ts` — `mintIngestToken(userId)` uses `randomBytes(32).toString("base64url")` for the secret and `hashToken` (Task 1) for `secretHash`; `splitIngestToken(raw)` trims an optional `Bearer ` prefix, finds the first `.`, returns `null` when missing/empty halves.
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: apple-health ingest token format helpers (apple-health)`

## Task 3: HAE payload parser/validator (Zod) — TDD

**Files:** Create `src/lib/apple-health/parser.ts`, `src/lib/apple-health/parser.test.ts`.
**Capture-gated:** the *shape* below is from the live docs (`{ data: { metrics: [{ name, units, data: [...] }], workouts?: [...] } }`); confirm against the captured push before locking, but the tolerance contract (ignore extra arrays, accept batched subsets, coerce numeric strings) is fixed and tested.

`parseHaePayload(raw): { metrics, workouts }` — validates the documented shape, **ignores** the extra top-level arrays HAE may send (`stateOfMind`, `medications`, `symptoms`, `cycleTracking`, `ecg`, `heartRateNotifications`, etc.), tolerates a missing `workouts` (batched subset), and **coerces numeric strings to numbers** (`z.coerce.number()`), preserving `name`/`units` as strings.

- [ ] **Step 1: Failing tests** in `parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseHaePayload } from "./parser";

describe("parseHaePayload", () => {
  it("parses a minimal metrics-only payload", () => {
    const out = parseHaePayload({ data: { metrics: [{ name: "step_count", units: "count", data: [{ date: "2026-06-05 00:00:00 -0700", qty: "8421" }] }] } });
    expect(out.metrics[0].name).toBe("step_count");
    expect(out.metrics[0].data[0].qty).toBe(8421); // coerced from string
    expect(out.workouts).toEqual([]);
  });
  it("ignores unknown top-level arrays (stateOfMind, symptoms, …)", () => {
    const out = parseHaePayload({ data: { metrics: [], workouts: [], stateOfMind: [{ x: 1 }], symptoms: [{ y: 2 }] } });
    expect(out.metrics).toEqual([]);
    expect(out.workouts).toEqual([]);
  });
  it("tolerates a batched subset (workouts absent)", () => {
    const out = parseHaePayload({ data: { metrics: [{ name: "weight_body_mass", units: "lb", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 181.4 }] }] } });
    expect(out.workouts).toEqual([]);
  });
  it("rejects a payload missing data.metrics (throws / returns a typed error)", () => {
    expect(() => parseHaePayload({ data: {} })).toThrow();
    expect(() => parseHaePayload({})).toThrow();
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `parser.ts` with a Zod schema: `data.metrics` = array of `{ name: z.string(), units: z.string(), data: z.array(z.object({ date: z.string(), qty: z.coerce.number().optional(), ... }).passthrough()) }`; `data.workouts` optional, defaulting to `[]`; top-level `.passthrough()` so extra arrays are ignored, not rejected. Export the inferred types. `parseHaePayload` runs `schema.parse` and returns `{ metrics, workouts }`. (Whether it `throw`s a `ZodError` or returns a typed result is your call — the route maps a parse failure to `400`; keep it simple and let the route catch.)
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: HAE payload Zod parser (tolerant + coercing) (apple-health)`

## Task 4: Metric mapper `mapMetricsToDays` — TDD

**Files:** Create `src/lib/apple-health/health.ts`, `src/lib/apple-health/health.test.ts`.
**Capture-gated:** the exact metric `name` keys + `units` strings come from the captured push; the rounding / unit-conversion / omit-absent-keys / local-date-keying *contract* below is fixed and tested. Mirror `src/lib/whoop/health.ts`'s "build a partial row, include a key only when present" discipline.

**Mapping contract (resolved open items folded in):**

| HAE metric `name` (confirm at capture) | `units` | `health_snapshots` column | Conversion / rounding |
|---|---|---|---|
| `step_count` | `count` | `steps` (int) | sum the day's `qty`; `Math.round` |
| `active_energy` | `kcal`/`kJ` | **NOT persisted (option A)** | parsed + carried through but dropped — no column today |
| `resting_heart_rate` | `bpm`/`count/min` | `rhr` (int) | day value (latest/avg) → `Math.round` |
| `heart_rate_variability` | `ms` | `hrv` (int) | day value → `Math.round` |
| `sleep_analysis` | `hr`/`min` | `sleep_hours` (numeric(4,1)) | **`asleep`** field (time actually asleep, matches Whoop semantics) → round to 1 decimal |
| `weight_body_mass`/`body_mass` | `lb`/`kg` | `weight` (numeric(6,2)) + `weight_unit` | store native value; set `weight_unit` (`lb`→`lbs`, `kg`→`kg`); round to 2 decimals |

- **`active_energy` → option A (resolved):** drop from v1's persisted columns. It is still *selected* in HAE (so the payload shape is exercised) and parsed, but `mapMetricsToDays` does not emit a column for it — `health_snapshots` has no active-calories column and adding one is out of scope. Note in a code comment.
- **Sleep field → `asleep` (resolved):** prefer `asleep` over `totalSleep` to match Whoop's sleep-duration semantics. Confirm the field name at capture.
- **Overlap metrics (rhr/hrv/sleep_hours, shared with Whoop) → last-write-wins (resolved):** whichever source syncs last for a day wins those columns. No priority arbitration in v1; note it in a comment.
- **Local-date keying:** key each row by the **date portion** of HAE's local timestamp (HAE already aggregates per local day and sends `yyyy-MM-dd HH:mm:ss Z`). Extract the leading `YYYY-MM-DD` substring — no server-side tz recompute.
- **Omit-absent-keys:** include a column key ONLY when that metric is present in this payload, so the partial upsert never nulls another source's columns (Whoop's `recovery_score`/`strain`, manual `vo2_max`).

- [ ] **Step 1: Failing tests** in `health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapMetricsToDays } from "./health";

describe("mapMetricsToDays", () => {
  it("maps + rounds present metrics, keys by local date, tags source", () => {
    const rows = mapMetricsToDays([
      { name: "step_count", units: "count", data: [
        { date: "2026-06-05 09:00:00 -0700", qty: 4000 },
        { date: "2026-06-05 18:00:00 -0700", qty: 4421 }, // same day → summed
      ] },
      { name: "weight_body_mass", units: "lb", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 181.44 }] },
      { name: "resting_heart_rate", units: "bpm", data: [{ date: "2026-06-05 06:00:00 -0700", qty: 54.6 }] },
    ]);
    const day = rows.find((r) => r.date === "2026-06-05")!;
    expect(day).toMatchObject({ date: "2026-06-05", source: "apple_health", steps: 8421, rhr: 55, weight: 181.44, weight_unit: "lbs" });
  });
  it("omits columns for absent metrics (partial upsert won't null them)", () => {
    const rows = mapMetricsToDays([{ name: "step_count", units: "count", data: [{ date: "2026-06-05 09:00:00 -0700", qty: 100 }] }]);
    const day = rows[0];
    expect(day.steps).toBe(100);
    expect("weight" in day).toBe(false);
    expect("hrv" in day).toBe(false);
    expect("rhr" in day).toBe(false);
  });
  it("converts kg weight and sets weight_unit accordingly", () => {
    const rows = mapMetricsToDays([{ name: "weight_body_mass", units: "kg", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 82.345 }] }]);
    expect(rows[0]).toMatchObject({ weight: 82.35, weight_unit: "kg" }); // stored native, 2 decimals
  });
  it("does NOT emit any column for active_energy (option A — no column today)", () => {
    const rows = mapMetricsToDays([{ name: "active_energy", units: "kcal", data: [{ date: "2026-06-05 12:00:00 -0700", qty: 540 }] }]);
    // active_energy alone yields a day row with only date+source (or is skipped) — never an active_energy column.
    for (const r of rows) expect("active_energy" in r).toBe(false);
  });
  it("groups samples across multiple local days into separate rows", () => {
    const rows = mapMetricsToDays([{ name: "step_count", units: "count", data: [
      { date: "2026-06-04 23:00:00 -0700", qty: 200 },
      { date: "2026-06-05 01:00:00 -0700", qty: 300 },
    ] }]);
    expect(rows.map((r) => r.date).sort()).toEqual(["2026-06-04", "2026-06-05"]);
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `mapMetricsToDays(metrics)`: build a `Map<localDate, partialRow>`; for each metric, switch on `name` to pick column + aggregation (sum for steps, latest/avg for rhr/hrv, `asleep`→hours for sleep, latest for weight + set `weight_unit`); apply the rounding table; **skip `active_energy` entirely** (option A); set `date` + `source: "apple_health"` on every row; include a metric key only when a value was produced. Return `Array<partialRow>`. **The local-date extraction is the one genuinely novel piece — give it a focused test (covered above).**
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: apple-health metric mapper (partial rows, last-write-wins) (apple-health)`

## Task 5: Workout mapper `mapWorkout` + deterministic `external_id` — TDD

**Files:** Create `src/lib/apple-health/workouts.ts`, `src/lib/apple-health/workouts.test.ts`.
**Capture-gated:** confirm the workout field nesting + whether HAE's workout `id` is durable across re-pushes. **Resolution (open item):** use HAE's `id` **if present**, else the synthesized hash — so a durable id is honored but a missing one never produces a null `external_id`.

**Mapping contract:**

| HAE workout field | `workouts` column | Conversion |
|---|---|---|
| `id` if present **else** `sha256(`start`|`name`|`duration`)` truncated, prefixed `ah_` | `external_id` | **never null** — drop the workout if neither yields a value |
| `name` | `sport` | lowercase readable string; unknown/empty → `"workout"` |
| `start` (`yyyy-MM-dd HH:mm:ss Z`) | `started_at` | parse → ISO `timestamptz` |
| `end` | `ended_at` | parse → ISO |
| `duration` (sec) | `duration_sec` | round to int |
| `heartRate.avg.qty` | `avg_hr` | `Math.round` |
| `heartRate.max.qty` | `max_hr` | `Math.round` |
| `activeEnergyBurned.qty`/`totalEnergy.qty` | `energy_kj` | kcal→kJ (`×4.184`, round 1 dp) if kcal; else store directly |
| `distance.qty` | `distance_m` | → metres if needed; round 1 dp |
| — | `strain` | **null** (Apple has no strain) |
| raw extras | `source_metadata` | `{}` or trimmed raw |

- [ ] **Step 1: Failing tests** in `workouts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapWorkout } from "./workouts";

describe("mapWorkout", () => {
  it("uses HAE id when present; rounds HR; sets source/started_at", () => {
    const row = mapWorkout({
      id: "ABC-123", name: "Running",
      start: "2026-06-05 12:00:00 -0700", end: "2026-06-05 12:45:00 -0700",
      duration: 2700, heartRate: { avg: { qty: 142.6 }, max: { qty: 171.2 } },
    });
    expect(row).toMatchObject({ source: "apple_health", external_id: "ABC-123", duration_sec: 2700, avg_hr: 143, max_hr: 171, strain: null });
    expect(typeof row!.sport).toBe("string");
    expect(typeof row!.started_at).toBe("string"); // ISO
  });
  it("synthesizes a deterministic ah_ id when HAE id is absent (same input → same id)", () => {
    const input = { name: "Functional Strength Training", start: "2026-06-05 06:00:00 -0700", duration: 1800 };
    const a = mapWorkout(input)!; const b = mapWorkout({ ...input })!;
    expect(a.external_id).toBe(b.external_id);
    expect(a.external_id).toMatch(/^ah_[0-9a-f]+$/);
  });
  it("converts kcal energy to kJ (×4.184, 1 dp)", () => {
    const row = mapWorkout({ id: "x", name: "Cycling", start: "2026-06-05 12:00:00 -0700", duration: 600, activeEnergyBurned: { qty: 100, units: "kcal" } });
    expect(row!.energy_kj).toBe(418.4);
  });
  it("drops a workout that can't produce a non-null external_id (no id AND no start)", () => {
    expect(mapWorkout({ name: "Walking", duration: 100 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `mapWorkout(raw)`: compute `external_id` (raw `id` if truthy, else synthesize from `start|name|duration` — return `null` if the synthesis inputs are too sparse to be stable, e.g. no `start`); map fields per the table; `strain: null`; `source: "apple_health"`; `Math.round` HR; kcal→kJ when `units==="kcal"`; round energy/distance to 1 dp. Return the row or `null`.
- [ ] **Step 4: Run → pass**; `npx tsc --noEmit`. **Commit** — `feat: apple-health workout mapper (deterministic external_id, drop-null) (apple-health)`

## Task 6: Ingest sync core `ingestAppleHealth`

**Files:** Create `src/lib/sync/apple-health.ts`.
Mirror `src/lib/sync/calendar.ts` for the sync_runs/error_events scaffolding; reuse the writers from Task 0. **No token refresh, no OAuth** — this takes an already-parsed payload + a resolved `userId`.

`ingestAppleHealth(client, userId, payload)`:
- `payload` is the **already-validated** `{ metrics, workouts }` from `parseHaePayload` (the route parses; this function just maps + writes — keeps the route thin and this function unit-testable later if desired).
- **Stream A (metrics):** `mapMetricsToDays(payload.metrics)` → add `user_id` to each row → `upsertHealthSnapshots(client, rows)` (Task 0 helper, partial merge `onConflict: "user_id,date"`). Skip when no rows.
- **Stream B (workouts):** `payload.workouts.map(mapWorkout).filter(Boolean)` → add `user_id` → `upsertWorkouts(client, rows)` (Task 0 helper, `onConflict: "user_id,source,external_id"`). Skip when empty.
- **Failure isolation:** each stream in its own try/catch. A stream error → `error_events` `{ user_id, provider: "apple_health", severity: "error", message, context: { stage: "ingestMetrics" | "ingestWorkouts" } }` **with NO health values in the message** (counts/names/stage only), sets a `partial` flag; the other stream still runs.
- **Finish:** `touchLastSyncedFor(client, userId, "apple_health")`; write a `sync_runs` row `{ user_id, provider: "apple_health", started_at, finished_at, rows_synced: metricDays + workoutRows, status: anyStreamFailed ? "partial" : "ok", error_message }`. (`sync_runs.status ∈ {ok,partial,failed}`, `error_events.severity ∈ {info,warn,error}` — per `20260527120012_create_observability.sql`.) Return `{ ok, status, metricDays, workoutRows }`.
- Use the **passed** client; never create one.

- [ ] **Step 1:** Implement per above (mirror `writeSyncRun` + the best-effort catch from `calendar.ts`). **Note:** `provider` must be `'apple_health'` to match the Settings row + the `integrations` lookup — never `'apple-health'`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** — `feat: apple-health ingest sync core (two writers, isolated streams) (apple-health)`

## Task 7: The inbound ingest route `POST /api/apple-health/ingest`

**Files:** Create `src/app/api/apple-health/ingest/route.ts`. `export const maxDuration = 60;` `export const runtime = "nodejs";`

A **public** route (no session cookie — HAE is an external client). **Order matters (cheap rejection of bad-token floods):**

1. **Read the secret** from the `Authorization` header (fall back to `X-API-Key`). `splitIngestToken(rawHeader)` (Task 2) → `{ userId, secret }` or `null`. Null → `401`.
2. **Resolve + verify BEFORE parsing the body.** `createAdminClient()`; `getIntegration(admin, userId, "apple_health")`. Read the stored hash from `integration.metadata.token_hash`. `compareToken(secret, storedHash)` (Task 1) → false / missing integration / missing hash → `401`. **This happens before `request.json()` / Zod**, so a flood of bad tokens costs one indexed `integrations` lookup + a hash compare and never reaches the parser or the writers.
3. **Payload size cap:** check `Content-Length`; if `> 4_000_000` → `413` (before reading the body). Also defensively cap the read body length.
4. **Rate limit (see Task 8 decision).** Apply the chosen limiter here (after auth, so it only meters authenticated traffic).
5. **Parse:** `await request.json()` then `parseHaePayload(...)`. On failure → `400` and an `error_events` row `{ severity: "warn", context: { stage: "parse" } }` with **the failing field path only, no values**.
6. **Ingest:** `ingestAppleHealth(admin, userId, parsed)`. Return `200 { ok, metricDays, workoutRows }` (even on a `partial` — so HAE doesn't treat a partial as a hard failure and spam retries). A thrown unexpected error → `500`.
7. **CONNECTED semantics:** the route itself does nothing special — `touchLastSyncedFor` inside `ingestAppleHealth` stamps `last_synced_at`, which is what flips the Settings row from `TOKEN SET` to `CONNECTED` (Task 9).
- Uses the **service-role admin client** (no cookie); RLS is bypassed, so **every query is explicitly `user_id`-scoped** (the id resolved from the token) — never trust any `user_id` in the body.
- **No health values in any log line** — only metric names, counts, stages.

- [ ] **Step 1:** Implement per the ordered steps. **Step 2:** `npx tsc --noEmit`; `pnpm build` (route table shows `/api/apple-health/ingest`). **Commit** — `feat: apple-health inbound ingest route (token auth, size cap) (apple-health)`

## Task 8: Rate limiting — pick one approach (reviewer-flagged)

**Files:** depends on the decision (route code, or `vercel.json`/dashboard config note).

**Pick ONE and implement it:**
- **Option A — Vercel Firewall rate-limit rule (PREFERRED on Pro, no app code):** a rule on path `/api/apple-health/ingest` capping e.g. **≤ 30 req / 10 min per IP**. Lowest code; configured in the Vercel dashboard / firewall config. Document the exact rule here so it's reproducible.
- **Option B — DB-counted window in the route:** after auth, count this user's `sync_runs` rows for `provider='apple_health'` in the last 10 min; if `≥ 30` → `429`. Simple, no platform dependency.

**Decision (resolve at build):** prefer **Option A** if Vercel Pro exposes a firewall rate-limit rule on the route path (it does on Pro) — zero app code, and it meters at the edge before the function runs. Fall back to **Option B** only if the firewall rule isn't workable.

> **Explicit note to record in the route comment + Notes section:** bad-token floods are rejected at step 2 of Task 7 **before any `sync_runs` write**, so a DB-counted window (Option B) only meters *authenticated* traffic. **Unauthenticated abuse protection therefore rests on the Vercel platform/firewall layer** (Option A, or Vercel's built-in DDoS/body limits) — the DB window is not a defense against an unauthenticated flood.

- [ ] **Step 1:** Implement the chosen option (Option A: add + document the firewall rule; Option B: add the windowed count → `429` in the route, after auth, before parse).
- [ ] **Step 2: Verify** `npx tsc --noEmit`; `pnpm build` (if route changed). **Commit** — `feat: apple-health ingest rate limit (<approach>) (apple-health)`

## Task 9: Settings — token issuance actions + Apple Health connection row

**Files:** Modify `src/app/(app)/settings/_actions/connections.ts`; Create `src/app/(app)/settings/AppleHealthConnectionRow.tsx`; Modify `src/app/(app)/settings/ConnectionsCard.tsx`.

- [ ] **Step 1:** In `_actions/connections.ts` add (mirroring `disconnectGoogle`, using the cookie client + `getCurrentUserId`):
  - `regenerateAppleHealthToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }>` — `mintIngestToken(userId)` (Task 2); **upsert** the `integrations` row (`provider='apple_health'`, `status='connected'`, `metadata: { token_hash: secretHash, token_created_at: <iso> }`) on `onConflict: "user_id,provider"` (rotating overwrites the hash → old token instantly rejected); revalidate `/settings`; return the **plaintext token once**. (Store the hash only — never the plaintext.)
  - `disconnectAppleHealth(): Promise<ActionResult>` — delete the `integrations` row where `provider='apple_health'`; revalidate `/settings`, `/dashboard`, `/train`.
- [ ] **Step 2:** Create `AppleHealthConnectionRow.tsx` (`"use client"`) by mirroring `GoogleConnectionRow.tsx`'s primitives/styling, but with the **non-OAuth affordance** — there is no "Connect"/consent redirect:
  - **Status label:** `NOT CONNECTED` when no integration row; `TOKEN SET` when a row exists but `last_synced_at` is null (no push yet); `CONNECTED` once `last_synced_at` is non-null (first push landed). (Resolved open item.) Show `· SYNCED <staleLabel> AGO` when connected (reuse the `syncedLabel` prop, computed server-side in `ConnectionsCard` via `staleAgeLabel` — same hydration-safe pattern as the Google row).
  - **Primary action:** a **"Generate token"** button (calls `regenerateAppleHealthToken` via `useTransition`). On success, reveal a one-time panel showing the **ingest URL** (`https://personal-os-azure-eight.vercel.app/api/apple-health/ingest`), the **header** (`Authorization: Bearer <token>`), and the **plaintext token** with a copy affordance + a "copy it now, shown once" warning. After dismiss/refresh the token is masked with a **"Regenerate"** button (regenerate rotates the hash).
  - A short "paste these into Health Auto Export" hint.
  - A **"Disconnect"** button (calls `disconnectAppleHealth`, with a `window.confirm`) when a row exists.
  - **Do NOT** add a `?connected=` auto-sync effect (there's no OAuth round-trip; data arrives via push).
- [ ] **Step 3:** In `ConnectionsCard.tsx`, load `getIntegration(supabase, userId, "apple_health")`, compute `syncedLabel` via `staleAgeLabel`, and render `<AppleHealthConnectionRow .../>` **replacing the static `Health Auto Export` entry** in `PENDING_PROVIDERS` (remove that one entry; keep Plaid static). Pass `status`, `hasToken` (row exists), `connected` (`last_synced_at` non-null), `syncedLabel`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`; `pnpm lint`; `pnpm build`. **Commit** — `feat: apple-health settings token row + actions (apple-health)`

## Task 10: Verify Health page + Train Activity render Apple data (likely no code change)

**Files:** Read `src/app/(app)/health/page.tsx`, `src/app/(app)/train/page.tsx`.

- [ ] **Step 1:** Confirm the Health page renders steps/weight/sleep/HRV/RHR from the latest `health_snapshots` row (it does today) — the partial-merge populates that row, so Apple metrics appear with no change. Confirm the Train Activity section (added by the Whoop slice) reads `workouts` ordered by `started_at` — Apple workouts appear there by source tag with no change.
- [ ] **Step 2:** If a metric is conspicuously unhandled, adjust copy only — do NOT rebuild working UI. If no change: note "verified, no change." Otherwise `npx tsc --noEmit`; `pnpm lint`; `pnpm build`; commit.

## Task 11: Playwright + full verification gate (incl. bad-token 401 + Whoop regression)

**Files:** Create `tests/e2e/apple-health.spec.ts`.
**Reminder (project memory `verify-build-not-just-e2e`):** Playwright runs via `next dev` and ignores TS/lint — the gate MUST include tsc + lint + build + vitest.

- [ ] **Step 1:** Create `tests/e2e/apple-health.spec.ts` (UNAUTHENTICATED, mirror `tests/e2e/connections.spec.ts`). Because the ingest route is **public** (not session-gated), assert the **auth behavior directly** with `request` (no browser nav):
  - `POST /api/apple-health/ingest` with **no `Authorization` header** → **401**.
  - `POST` with `Authorization: Bearer garbage.token` (well-formed shape, no matching integration) → **401**.
  - `POST` with `Authorization: Bearer not-a-valid-format` (no dot) → **401**.
  - (Do NOT mint a real token or hit the DB writers in CI — a valid-token happy path is Max's manual acceptance seam. The 401 cases need no auth fixture.)

```ts
import { test, expect } from "@playwright/test";

test.describe("apple-health ingest — unauthenticated", () => {
  test("no token → 401", async ({ request }) => {
    const res = await request.post("/api/apple-health/ingest", { data: { data: { metrics: [] } } });
    expect(res.status()).toBe(401);
  });
  test("bad token → 401", async ({ request }) => {
    const res = await request.post("/api/apple-health/ingest", {
      headers: { Authorization: "Bearer 00000000-0000-0000-0000-000000000000.wrong-secret" },
      data: { data: { metrics: [] } },
    });
    expect(res.status()).toBe(401);
  });
  test("malformed token (no dot) → 401", async ({ request }) => {
    const res = await request.post("/api/apple-health/ingest", {
      headers: { Authorization: "Bearer nodot" },
      data: { data: { metrics: [] } },
    });
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run the full gate:**
  - `pnpm test` → all unit pass (crypto incl. new `hashToken`/`compareToken`, `ingest-token`, `parser`, apple `health`, apple `workouts`, plus the untouched Whoop/Google/store/stale suites).
  - `npx tsc --noEmit` → 0 errors.
  - `pnpm lint` → 0 errors.
  - `pnpm build` → succeeds; route table shows `/api/apple-health/ingest`.
  - `pnpm test:e2e` → green (the 3 unauthenticated 401 cases above).
- [ ] **Step 3: Whoop regression check (CODE-level, automatable now):** the only shared mutable foundation this slice touches is the **factored-out writers (Task 0)**. Confirm: (a) `src/lib/whoop/health.test.ts` + `src/lib/whoop/workouts.test.ts` still pass unchanged; (b) if Task 0 factored the writers, `syncWhoop` still calls them with identical `onConflict` + no-op-on-empty behavior (the Whoop unit tests + a quick read of `syncWhoop` confirm the partial-merge for `health_snapshots` is byte-for-byte unchanged); (c) `GoogleConnectionRow.tsx` is untouched. The *runtime* multi-source merge (a Whoop row + an Apple ingest on the same day) is part of manual acceptance below.
- [ ] **Step 4: Commit** — `test: e2e apple-health 401 + green full gate (apple-health)`

---

## Manual acceptance gate (Max, on the deployed site — unautomatable)

After Max's pre-flight (HAE installed + configured) and a deploy:

1. **Generate:** Settings → Connections → Apple Health → **Generate token** → copy the ingest URL + `Authorization: Bearer <token>`. Row shows **TOKEN SET**.
2. **Configure HAE** with the URL + header + the six metrics + workouts + Daily aggregation + Batch ON, run an **initial manual export** over a wider range.
3. **Land:** within a few minutes the row flips to **CONNECTED · SYNCED … AGO**; **steps / body weight** (and **RHR / HRV / sleep** on Whoop-less days) appear in the **Health view**, and **Apple Watch workouts** appear in the **Train Activity section** (web + mobile).
4. **Merge contract (the core guarantee):** with a Whoop `recovery_score`/`strain` already on today's row (and/or a manual `vo2_max`), trigger an Apple push → confirm **Whoop's + the manual columns survive** while `steps`/`weight` populate the *same* day's row. Re-push the *same* HAE payload → confirm **no workout duplicates** (deterministic `external_id`) and the day row is unchanged.
5. **Rotate / reconnect:** **Regenerate** the token → the old token's pushes now **401** (HAE will show failures until Max updates the header); update HAE with the new token → pushes resume. **Disconnect** → row returns to NOT CONNECTED; regenerate works.
6. **Whoop regression (runtime):** confirm the Whoop hourly sync still writes `health_snapshots` correctly (recovery/strain land, and don't clobber Apple's steps/weight on a shared day) — the shared partial-merge writer behaves identically for both sources.

Passing = Apple Health slice done. **Roadmap context:** Strava (workouts → same `workouts` table) and Plaid (finance) are the remaining 1B slices; Gmail parked.

## Notes / deviations
- **Non-OAuth by design:** no token store (AES), no connect/callback redirect, no cron, no token refresh. The only auth lever on a push endpoint is the per-user ingest token (`<userId>.<secret>`, hash stored in `integrations.metadata.token_hash`, plaintext shown once). This is the deliberate divergence from Whoop/Google.
- **Token hashing, not encryption:** `hashToken`/`compareToken` (sha256 + `timingSafeEqual` on fixed-length 32-byte digests) are new in `crypto/tokens.ts`; the AES encrypt/decrypt path is untouched and not used here. `TOKEN_ENCRYPTION_KEY` is **not** required by this slice.
- **Dependency assertion (Task 0):** the reusable `health_snapshots` partial-merge + `workouts` upsert are **verified, and factored out if the Whoop slice inlined them** — not assumed. This slice adds essentially no new shared mutable foundation beyond those helpers, keeping the regression surface tiny.
- **Auth before parse:** the token is verified (one indexed `integrations` lookup + a hash compare) **before** `request.json()`/Zod, so bad-token floods are rejected cheaply and never reach the writers or `sync_runs`. Consequently a DB-counted rate window (Option B) meters **only authenticated** traffic; **unauthenticated abuse protection rests on the Vercel platform/firewall layer** (Option A preferred).
- **Resolved spec open items:** `active_energy` = option A (selected in HAE, parsed, **not persisted** — no column); workout `id` = HAE id if present else synthesized `ah_<hash>`; sleep = `asleep`; CONNECTED = `TOKEN SET` at generation, `CONNECTED` only after first push (`last_synced_at` non-null); overlap metrics (RHR/HRV/sleep shared with Whoop) = **last-write-wins** in v1 (noted in code).
- **Idempotency:** metrics = partial column-merge on `(user_id, date)` (shared row, columns survive); workouts = blind upsert on `(user_id, source, external_id)` with a deterministic, never-null `external_id` (drop-null). HAE re-sends overlapping windows → both writes are safe to repeat.
- **Capture-gated field extraction:** the mapper field names/units (Tasks 2–5) are wired **after** capturing one real HAE push; the tested logic (rounding, omit-absent-keys, kcal/kJ, lb/kg, deterministic id, local-date keying) is fixed and does not depend on the capture.
- **No `vercel.json` change** — HAE is the scheduler; this slice adds no cron.
