# Phase 1B · Slice — Apple Health (Health Metrics + Workouts via Health Auto Export)

> ⚠ **DEPRECATED 2026-06-08 — superseded by native HealthKit.** This slice (Health Auto Export REST
> push → ingest endpoint) shipped to prod but is now **end-of-life**. Apple Health moves to **direct
> HealthKit access in the native iOS app** (Swift), which becomes the sole Apple Health route — see
> `2026-06-08-personal-os-native-mobile-app-design.md` §3. The HAE ingest route + token UI stay in
> prod only until the native HealthKit module ships, then they're removed. **What carries forward:**
> the metric set, the `health_snapshots` partial-merge + `workouts` upsert contracts, the
> `apple_health` source tag, and multi-source coexistence with Whoop — all reused by the native
> module (only the transport changes). The HAE-specific design below (ingest token, public route,
> HAE payload parser, rate-limiting) is **historical** once removal lands.

**Status:** Design (drafted 2026-06-05; pending reviewed spec + plan)
**Date:** 2026-06-05
**Parent spec:** `docs/superpowers/specs/2026-05-21-personal-os-design.md` (§6 Integrations)
**Template:** `docs/superpowers/specs/2026-06-05-personal-os-whoop-health-design.md` — the Whoop slice. This spec **mirrors Whoop's data-landing patterns** (the `health_snapshots` partial-merge, the `workouts` upsert, the `sync_runs`/`error_events` observability) and **deliberately diverges on the connection model**: Apple Health is **inbound push, not OAuth**, so it does NOT use the OAuth token store, connect/callback redirect, or the Vercel polling cron.
**Builds on:** the merged Whoop foundation (`workouts` table `20260605120000`, `health_snapshots` partial-merge writer, `ProviderConnectionRow`, generalized observability). **Read the landed Whoop code first** — this slice reuses its mapper/upsert layer wholesale.

---

## 1. Goal / Outcome

Max installs the **Health Auto Export** iOS app on his iPhone once, points its **REST API Automation** at a Personal OS ingest endpoint with a secret token, and selects a fixed metric set + workouts. After that, his iPhone **pushes** Apple Health data to Personal OS on a schedule (e.g. hourly). The dashboard **Health view** fills in metrics Whoop doesn't cover — most importantly **steps**, **active energy**, and **body weight** — and **Apple Watch workouts** appear in the **Train page Activity section** alongside Whoop workouts, all source-tagged `apple_health`.

The point of this slice is **multi-source coexistence**: Apple Health and Whoop both write into the *same* `health_snapshots` daily row via **partial column-merge**, so each fills the days/metrics the other leaves blank without clobbering the other. No new health surfaces are built — the Health page and Train Activity list already render from these tables; this slice just feeds them a second source through a **new inbound ingestion path**.

## 2. Decisions locked in this brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Provider / transport | **Apple Health via the "Health Auto Export — JSON+CSV" iOS app (by Lybron / HealthyApps), REST API "Automation", JSON POST** | No public Apple HealthKit cloud API exists; HAE is the established bridge that pushes HealthKit data to an HTTP endpoint. **Not OAuth, no file storage, no redirect.** ([HAE REST API docs](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/)) |
| Connection model | **Per-user ingest token**, generated in Settings, stored **hashed** in the existing `integrations` row (`provider='apple_health'`), sent by HAE as a custom HTTP header | HAE supports arbitrary custom headers (e.g. `Authorization: Bearer …`, `X-API-Key: …`) — the only auth lever on a push endpoint. ([HAE custom headers](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/)) |
| Core metric set (v1) | **steps, active energy, resting heart rate, HRV, sleep, body weight** → `health_snapshots` (partial-merge) | These are the columns Whoop leaves gaps in (esp. steps / active energy / weight) plus overlap metrics (RHR / HRV / sleep) Apple can backfill on Whoop-less days. |
| Workouts | **In scope** — HAE `workouts[]` → existing `workouts` table, `source='apple_health'` | Apple Watch workouts feed the same provider-agnostic table Whoop/Strava use; shown in the existing Train Activity section. |
| Landing — metrics | Existing `health_snapshots`, `source='apple_health'`, upsert on `(user_id, date)` with **per-column merge** (identical to Whoop §3a) | The daily row is multi-source; Apple writes ONLY its present columns so Whoop/manual columns survive untouched. |
| Landing — workouts | Existing `workouts`, `source='apple_health'`, upsert on `(user_id, source, external_id)` | Each workout row is single-source-owned; plain upsert is correct (same as Whoop §3b). |
| Sync engine | **Inbound push only — NO Vercel cron, NO OAuth connect/callback** | HAE is the scheduler (it pushes on its own interval); Personal OS just accepts authenticated POSTs. This is the key architectural divergence from Whoop. |
| Idempotency | metrics = partial-merge on `(user_id, date)`; workouts = upsert on synthesized **deterministic `external_id`** (HAE workout `id` if durable, else a hash of `start+type+duration`) | HAE re-sends overlapping windows on every push; both writes must be safe to repeat. |
| Timezone | **Key each day by the local date HAE sends** (HAE aggregates per local day; its timestamps are local with offset) | Matches Whoop's "land on the user's local calendar day" rule; no server-side tz recompute needed for daily-aggregated metrics. |

## 3. Landing zones

### 3a. Daily metrics → existing `health_snapshots` (no migration — reuses Whoop's writer)

`public.health_snapshots` (`20260527120007`): `date`, `sleep_score`, `sleep_hours`, `recovery_score`, `strain`, `hrv`, `rhr`, `weight`, `weight_unit`, `steps`, `vo2_max`, `source ∈ {manual, whoop, apple_health, oura}`, `unique(user_id, date)`, full RLS. **`'apple_health'` is already an allowed source** — no migration.

**Mapping (HAE metric `name` + `units` → column, with conversion + rounding):**

| HAE metric (lowercase snake_case `name`) | HAE `units` (typical) | `health_snapshots` column | Conversion / rounding |
|---|---|---|---|
| `step_count` | `count` | `steps` (integer) | sum of day's `qty`; `Math.round` |
| `active_energy` | `kcal` (or `kJ`) | *(no dedicated column today)* | **see note below** |
| `resting_heart_rate` | `bpm` `count/min` | `rhr` (integer) | day value (latest/avg) → `Math.round` |
| `heart_rate_variability` | `ms` | `hrv` (integer) | day value → `Math.round` |
| `sleep_analysis` | `hr`/`min` (+ nested fields) | `sleep_hours` (numeric(4,1)) | `asleep` (or `totalSleep`) hours → round to 1 decimal |
| `weight_body_mass` (a.k.a. `body_mass`) | `lb` or `kg` | `weight` (numeric(6,2)) + `weight_unit` | store native value + set `weight_unit` to match HAE's unit (`lb`→`lbs`, `kg`→`kg`); round to 2 decimals |

**`active_energy` note (genuine gap — resolve at planning):** `health_snapshots` has **no `active_energy` / active-calories column today**. Three options, pick one at plan time:
- **(A) — recommended, YAGNI-respecting:** drop `active_energy` from v1's persisted columns (still *selected* in HAE so the payload shape is exercised, but unmapped) until the Health page actually surfaces an active-calories tile. Keeps zero migrations.
- **(B):** add `active_energy integer` to `health_snapshots` via a tiny additive migration + render a tile. Only if Max wants active-calories visible now.
- **(C):** stash it in a `health_snapshots.source_metadata`-style jsonb — but that column doesn't exist either, so this is really (B) in disguise.
The decision is purely "does Max want active calories on the dashboard *now*." **Default to (A)**; the locked scope lists active energy as a *selected HAE metric* (so the pipeline carries it) but the landing column is the open item.

**Merge policy (identical to Whoop §3a — single-statement, atomic, do NOT regress):** because multiple sources share the `(user_id, date)` row, an Apple Health ingest must **upsert a payload containing ONLY the Apple-owned columns that are present in this payload** (`user_id, date, source='apple_health'`, plus whichever of `steps, rhr, hrv, sleep_hours, weight, weight_unit` arrived) with `onConflict: 'user_id,date'`. Postgres `ON CONFLICT DO UPDATE` only sets the columns in the payload, so Whoop's `recovery_score`/`strain` and any manual `vo2_max` are **preserved untouched in one atomic statement** — no read-merge-write. **Reuse Whoop's `mapHealthDay`-style partial-row builder pattern verbatim** (build the row with only present keys; the partial upsert relies on absent keys not being nulled).

> **Multi-source nuance:** for overlap metrics (`rhr`, `hrv`, `sleep_hours`) both Whoop and Apple write the same columns, so **whichever syncs last wins for that day** — last-write-wins, no priority arbitration in v1. That's acceptable: on Whoop-less days Apple fills them; on Whoop days the values are close. If priority becomes a real problem, add a per-column source preference later (out of scope, §9).

### 3b. Workouts → existing `workouts` table (no migration)

`public.workouts` (`20260605120000`): `source ∈ {manual, whoop, strava, apple_health}` (already allows `apple_health`), `external_id`, `sport`, `started_at`, `ended_at`, `duration_sec`, `strain`, `avg_hr`, `max_hr`, `energy_kj`, `distance_m`, `source_metadata`, `unique(user_id, source, external_id)`, full RLS. **No migration.**

**Mapping (HAE `workouts[]` object → `workouts` row):**

| HAE workout field | `workouts` column | Conversion |
|---|---|---|
| `id` (if durable) **else** synthesized hash | `external_id` | see §5 idempotency — **never null** |
| `name` (e.g. "Running", "Functional Strength Training") | `sport` | normalize to lowercase readable string; unknown → `"workout"` |
| `start` (`yyyy-MM-dd HH:mm:ss Z`) | `started_at` | parse → ISO `timestamptz` |
| `end` | `ended_at` | parse → ISO |
| `duration` (seconds) | `duration_sec` | round to integer |
| `heartRate.avg.qty` | `avg_hr` | `Math.round` |
| `heartRate.max.qty` | `max_hr` | `Math.round` |
| `activeEnergyBurned.qty` / `totalEnergy.qty` | `energy_kj` | if HAE reports kcal, convert kcal→kJ (`×4.184`), round 1 decimal; if kJ, store directly |
| `distance.qty` | `distance_m` | convert to metres if needed; round 1 decimal |
| — | `strain` | **null** (Apple has no strain) |
| raw extras | `source_metadata` | optional `{}` or trimmed raw |

Apple Watch supplies sport/start/end/duration/HR/energy/distance; `strain` stays null (Apple-less concept). **Blind upsert is correct** (`onConflict: 'user_id,source,external_id'`) — each row single-source-owned, mirroring Whoop §3b. **Drop any workout that can't produce a non-null `external_id`** (NULLs are distinct in the unique index → would duplicate on every push).

## 4. Components

> **NEW foundation surface this slice adds (the part the build extends — see §11):** an **inbound ingest route**, a **non-OAuth connection model** (ingest token), and **token-based request auth + abuse protection**. Everything below the dotted line reuses Whoop's mapper/upsert/observability layer unchanged.

**New (the genuinely-new surface):**

- **Ingest route — `POST /api/apple-health/ingest`** (`export const maxDuration = 60;`, Node runtime). A **public** route handler (no auth cookie — HAE is an unauthenticated external client). It:
  1. Reads the secret from the configured header (recommend **`Authorization: Bearer <token>`**, fall back to `X-API-Key`), where the token encodes the `user_id` (see token format §5) so the route can resolve the user **without** a session.
  2. Looks up `integrations` where `provider='apple_health' AND user_id=<from token>`, reads the stored **token hash** from `metadata`, and verifies the presented token with a **constant-time compare** (reuse the `timingSafeEqual` pattern from `src/app/api/google-calendar/sync/route.ts`). Reject with `401` on any mismatch/missing token.
  3. Enforces a **payload size cap** (reject `> ~4 MB` with `413`) and **basic rate limiting** (see §7).
  4. Parses + validates the body with the Zod schema (below); on validation failure returns `400` (and records an `error_events` row, severity `warn`, with NO raw health values in the message).
  5. Calls the shared **metrics writer** (partial-merge §3a) and **workouts writer** (§3b), each in its own try/catch (partial-failure isolation, exactly like Whoop's two-stream sync).
  6. Stamps `integrations.last_synced_at` (reuse `touchLastSyncedFor(client, userId, 'apple_health')`) and writes a `sync_runs` row (`provider='apple_health'`, `status: ok | partial`, `rows_synced = metricDays + workoutRows`). Returns `200 { ok, metricDays, workoutRows }`.
  - Uses the **service-role admin client** (`src/lib/supabase/admin.ts`) — there is no user cookie on this request, so RLS is bypassed and **every read/write is explicitly scoped by `user_id`** (same discipline as the Whoop cron path).

- **HAE payload parser/validator — `src/lib/apple-health/parser.ts`** (Zod). Validates the documented shape:
  ```
  { data: { metrics: [ { name: string, units: string, data: [ {...} ] } ], workouts?: [ {...} ] } }
  ```
  Tolerates the extra top-level arrays HAE may send (`stateOfMind`, `medications`, `symptoms`, `cycleTracking`, `ecg`, `heartRateNotifications`) by ignoring them. Tolerates **batched requests** (HAE's "Batch Requests" splits one export across multiple POSTs — each POST is a valid standalone payload with a subset of metrics, so the partial-merge handles it naturally). Numeric fields arrive as numbers *or* numeric strings — coerce.

- **Metric mapper — `src/lib/apple-health/health.ts`** (`mapMetricsToDays`). Pure function: takes the validated `metrics[]`, groups by the local `date` (date-only portion of each datum's timestamp), aggregates per the §3a table (sum steps, take day value for rhr/hrv, sum/total sleep hours, latest weight), rounds to each column's precision, returns an array of **partial** `health_snapshots` rows keyed by date — **only present columns included** (so the partial upsert won't null others). **Unit-test the rounding + omit-absent-keys + kcal/kJ + lb/kg + local-date-keying contract** (mirror `whoop/health.test.ts`).

- **Workout mapper — `src/lib/apple-health/workouts.ts`** (`mapWorkout`). Pure: HAE workout → `workouts` row **or `null`** (drop). Synthesizes the deterministic `external_id` (§5). **Unit-test:** the kcal→kJ conversion, HR rounding, the drop-when-no-id rule, and the **deterministic external_id stability** (same input → same id).

- **Ingest token issuance — Settings server action `regenerateAppleHealthToken()`** in `src/app/(app)/settings/_actions/connections.ts`. Generates a fresh token (§5), stores its **hash** + `created_at` in the `integrations` row's `metadata` (upsert `provider='apple_health'`, `status='connected'`), and returns the **plaintext token exactly once** so the UI can display it for copy-paste into HAE. Regenerating **rotates** (overwrites the hash → old token immediately rejected). A `disconnectAppleHealth()` action deletes the row (revalidate `/settings`, `/dashboard`, `/train`).

- **NON-OAuth connection row — `AppleHealthConnectionRow.tsx`** (a dedicated row, NOT the OAuth `ProviderConnectionRow`). Because there's no consent redirect, this row's affordance is **"Generate token"** / **"Show setup"**, not "Connect". It shows: status (`CONNECTED` once a token exists + has received ≥1 push, else `NOT CONNECTED`), `last_synced_at` "ago" label (reuse `staleAgeLabel`), the ingest **URL**, the **header name + plaintext token** (shown once on generation, masked thereafter with a "Regenerate" button), and a short "paste these into Health Auto Export" hint linking §10. Mirror `GoogleConnectionRow.tsx` styling/primitives. Wire into `ConnectionsCard.tsx`, replacing the existing static `Health Auto Export` placeholder row.

**Reused unchanged (no new code):**
- Token hashing — **reuse `src/lib/crypto/tokens.ts`** style; recommend hashing with Node `crypto.createHash('sha256')` (a hash, not the AES encrypt — we only ever *compare*, never need to decrypt the ingest token). The random token itself: `randomBytes(32).toString('base64url')`.
- `health_snapshots` partial-merge writer + `workouts` upsert (from Whoop sync core).
- Observability: `sync_runs` / `error_events` (`provider='apple_health'`), `touchLastSyncedFor`, `markStatusFor`.
- Health page + Train Activity section render from the tables already — **verify-only, no change** (same as Whoop Task 12 / 11).

## 5. Sync & data-flow architecture

- **Inbound push, single write path**, source-tagged `apple_health`. **No cron, no OAuth, no token refresh** — HAE's scheduler is the trigger; the only Personal OS surface is the authenticated ingest route.
- **Token format (resolve user without a session):** the token is `<userId>.<secret>` (the random 32-byte base64url secret). The route splits on the first `.`, looks up the `integrations` row for that `user_id`, hashes the presented `<secret>` and constant-time-compares it to the stored hash. (Storing only the hash means a DB leak doesn't expose live tokens.) Alternative considered & rejected: a path/query secret (`/api/apple-health/ingest?token=…`) — leaks into access logs; the header is cleaner. HAE supports both, so the header is enforced.
- **Idempotency — metrics:** HAE re-sends overlapping windows (its date ranges include "full previous day plus current date" by default, and "Since Last Sync" still overlaps). The **partial-merge upsert on `(user_id, date)`** makes every re-send safe — a day re-pushed just overwrites its own columns with the same/updated values. No dedup needed.
- **Idempotency — workouts:** needs a stable `external_id`. **Prefer HAE's workout `id`** if it's durable across exports (the v2 workout object exposes an `id`; confirm at build that the *same* workout keeps the *same* id across re-pushes). If it's not durable (or absent), **synthesize a deterministic id**: `sha256(\`${start}|${name}|${duration}\`)` truncated to e.g. 32 hex chars, prefixed `ah_`. Same workout → same id → idempotent upsert; never null. **Unit-test the synthesis is stable.**
- **Timezone:** HAE timestamps are `yyyy-MM-dd HH:mm:ss Z` (local time with offset) and HAE aggregates **per local day**. Key each `health_snapshots` row by the **date portion of HAE's local timestamp** — this *is* the user's calendar day, no server recompute. (Matches Whoop's "land on the local day" rule; the difference is Whoop computes the local day from `profiles.timezone`, whereas HAE has already done the local-day grouping for us.)
- **Freshness/health:** `integrations.last_synced_at` (stamped on each successful ingest) + `status` drive the existing stale chip. A connection is "stale" if no push has arrived in > its expected cadence (e.g. > 2h for an hourly automation) — surfaced by the same `staleAgeLabel` the other rows use. **There is no reconnect banner concept** (no token to expire) — staleness just means "your phone hasn't pushed lately," which the row's "SYNCED … AGO" label communicates.
- **Failure isolation:** a malformed/partial metrics block must not fail the workouts write and vice-versa — each writer in its own try/catch, errors → `error_events` (`context: { stage: 'ingestMetrics' | 'ingestWorkouts' }`), `sync_runs.status='partial'`, HTTP still `200` (so HAE doesn't treat a partial as a hard failure and spam retries). A hard auth failure is `401`; a malformed-body failure is `400`.

## 6. New environment variables

**None required.** The ingest token is generated per-user and stored (hashed) in the DB, so there is no app-wide secret to add. Reuses existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. (`TOKEN_ENCRYPTION_KEY` is **not** needed — the ingest token is hashed, not encrypted.)

The ingest URL is fixed: `https://personal-os-azure-eight.vercel.app/api/apple-health/ingest`.

## 7. Security

- **Public endpoint, token-gated:** the route is publicly reachable (HAE is an external client with no Personal OS session). Auth is the per-user ingest token in the `Authorization: Bearer` header, verified by **constant-time compare against a stored SHA-256 hash** (reuse the `timingSafeEqual` pattern). No token / wrong token → `401`. The token embeds `user_id` only as a lookup key; possession of the secret half is what authorizes.
- **Token storage:** only the **hash** is persisted (in `integrations.metadata`), never the plaintext — a DB compromise can't replay pushes. Plaintext shown to Max exactly once at generation.
- **Rotation:** "Regenerate" overwrites the stored hash → the old token is instantly invalid. Disconnect deletes the row.
- **Rate limiting / abuse protection on a public route:**
  - **Payload size cap** (`413` over ~4 MB) — bounds a single request; Vercel also enforces a body limit, but cap explicitly so a huge body is rejected before parsing.
  - **Per-token rate limit** — a connected phone pushes at most a few times/hour; cap to e.g. **≤ 30 requests / 10 min / user** (a sane ceiling that never blocks legitimate hourly+manual pushes). Implementation options at plan time: a lightweight DB-counted window on `sync_runs`, or **Vercel Firewall / rate-limiting rules** on the route path (preferred if available on Pro — no app code). **Resolve at planning** (see §11).
  - **Unauthenticated requests are cheap to reject** — verify the token (one indexed `integrations` lookup + a hash compare) *before* parsing the body, so a flood of bad tokens never reaches the Zod parser or the DB writers.
- **No PII / health values in logs:** `error_events.message` and any console logging must carry **only** metric *names*, counts, and stages — **never `qty` values, weights, HR, or dates of individual samples.** (Validation errors log the failing field path, not its value.)
- **RLS:** `health_snapshots` / `workouts` / `sync_runs` / `error_events` all RLS-protected; the service-role ingest path bypasses RLS, so **every query is explicitly `user_id`-scoped** (the user id resolved from the token) — never trust a `user_id` in the request body.

## 8. Acceptance gate

> Generate an Apple Health ingest token in `/settings` → paste the ingest URL + `Authorization: Bearer <token>` header into a Health Auto Export REST API Automation on the iPhone, select the metric set + workouts, aggregation = per day, run an initial export → confirm **steps / weight (and RHR / HRV / sleep on Whoop-less days)** land in `health_snapshots` and **Apple Watch workouts** land in `workouts` → the **Health view shows the Apple-sourced metrics** and the **Train Activity section shows the Apple workouts** (web + mobile) → a second scheduled push updates the current day without duplicating workouts.
>
> **Merge contract test (the core multi-source guarantee):** with a Whoop `recovery_score`/`strain` already on today's row (and/or a manual `vo2_max`), run an Apple Health ingest, and confirm **Whoop's and the manual columns survive** while `steps`/`weight` populate the *same* day's row. Then re-push the *same* HAE payload and confirm **no workout duplicates** (deterministic `external_id` upsert) and the day row is unchanged.
>
> **Auth test:** a POST with no token, a malformed token, or a token whose secret half is wrong → `401`. A POST with a valid token but a garbage body → `400` with a `warn` `error_events` row containing **no health values**. An oversized body → `413`.
>
> **Whoop regression check:** confirm the Whoop sync still writes `health_snapshots` correctly after this slice's writer is shared — the partial-merge writer must behave identically for both sources. (Apple Health adds no new shared mutable foundation code beyond the writer it *reuses*, so regression surface is small.)

## 9. Out of scope (deferred)

- The 100+ other HAE metrics (blood pressure, blood glucose, AFib/ECG, mindfulness/state-of-mind, cycle tracking, symptoms, medications, VO2 max, SpO2, respiratory rate, environmental audio, etc.) — v1 ingests **only** the six locked metrics + workouts; the parser **ignores** the rest.
- **Per-column source-priority arbitration** for overlap metrics (RHR/HRV/sleep) — v1 is last-write-wins. A source-preference policy is a later refinement.
- An `active_energy` column / active-calories tile unless Max opts into option (B) in §3a (default: not landed in v1).
- Sleep **stages** (HAE exposes `deep`/`rem`/`core`) — v1 stores only total `sleep_hours`; stage breakdown is deferred (same as Whoop).
- GPX route data / per-workout HR-zone breakdowns / detailed sample-level series — store daily aggregates + workout summaries only.
- CSV transport (HAE supports it) — JSON only.
- Push **acknowledgement back to HAE** beyond the HTTP status; HAE's own retry/scheduling is the delivery guarantee.

## 10. Max's one-time setup (~15 min, no external approval)

> **Lead time:** ~15 minutes, **no developer-account or API review** — unlike Whoop/Plaid there is no app to register and no human approval gate. The only "approval" is the App Store purchase. Token generation is instant. **Health Auto Export is a paid app** (one-time purchase / small subscription for the automation feature on the App Store — Max buys it once).

1. **Install Health Auto Export — JSON+CSV** (by HealthyApps / Lybron) from the iOS App Store on the iPhone and grant it read access to Apple Health (it pulls from HealthKit on-device). It's a **paid app** — purchase it.
2. **In Personal OS → Settings → Connections → Apple Health → "Generate token".** Copy the displayed **ingest URL** (`https://personal-os-azure-eight.vercel.app/api/apple-health/ingest`) and the **token** (shown once — copy it now; you can regenerate if lost).
3. **In Health Auto Export → Automations → create a new "REST API" Automation:**
   - **URL:** paste the ingest URL above.
   - **Format:** JSON.
   - **Headers → Add Header:** key `Authorization`, value `Bearer <paste-the-token>`. (HAE lets you add arbitrary headers — this is how the push authenticates.)
   - **Health Metrics → select exactly:** Step Count, Active Energy, Resting Heart Rate, Heart Rate Variability, Sleep Analysis, Body Mass (Weight). Leave everything else off.
   - **Workouts:** enable workout export.
   - **Aggregation:** "Summarize Data" / Time Grouping = **Daily** (one value per metric per day).
   - **Batch Requests:** ON (splits large exports into smaller POSTs — keeps each request under Vercel's body limit; the merge handles the split transparently).
   - **Schedule / cadence:** set the automation interval to **hourly** (a number + interval), with the date range left at the default (previous day + current day) so each push keeps today fresh and self-heals any missed hour.
4. **Initial backfill:** run a **manual export once** over a wider range (e.g. Previous 7 days, or use the app's manual export for ~30 days of the selected metrics) so the dashboard has history immediately. With Batch Requests ON, a large backfill arrives as several POSTs — all idempotent.
5. **Verify:** within a few minutes the Settings Apple Health row flips to **CONNECTED · SYNCED … AGO**, and steps/weight/workouts appear on the dashboard.

*(Reference: [HAE REST API automation docs](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/) — exact label wording may differ slightly by app version; the build should confirm against the installed app and adjust this click-by-click.)*

## 11. Open items to resolve at planning time

- **Exact HAE JSON metric `name` strings + units (BUILD-TIME EMPIRICAL CAPTURE — highest priority).** Live docs confirm: the top-level shape is `{ data: { metrics: [{ name, units, data: [...] }], workouts: [...] } }`; metric names are **lowercase snake_case** (verified examples: `heart_rate`, `sleep_analysis`, `blood_pressure`); timestamps are `yyyy-MM-dd HH:mm:ss Z`; daily aggregation sums activity, averages heart metrics, takes latest for body measurements. **But HAE does not publish a canonical `name`→identifier table** — the wiki shows display labels ("Step Count", "Active Energy", "Resting Heart Rate", "Heart Rate Variability", "Sleep Analysis", "Body Mass"). So the *exact* snake_case keys + unit strings for our six metrics (likely `step_count`, `active_energy`, `resting_heart_rate`, `heart_rate_variability`, `sleep_analysis`, `weight_body_mass`/`body_mass`) and the workout field nesting (`heartRate.avg.qty`, `activeEnergyBurned`/`totalEnergy`, energy unit kcal vs kJ, distance unit) **must be confirmed by capturing ONE real push from Max's phone** (or HAE's manual "preview JSON" export) before locking the mapper. The spec pins the *contract* (rounding, omit-absent-keys, deterministic id, local-date keying — all unit-tested); the field extraction is wired after the capture. **This mirrors exactly how the Whoop plan defers field names to a build-time docs check.**
- **`active_energy` landing (§3a):** confirm with Max whether active calories should be visible on the dashboard now → pick option (A) drop / (B) add column + tile. Default (A).
- **Workout `id` durability:** confirm whether HAE's workout `id` is stable across re-exports of the same workout. If yes, use it directly; if no/absent, use the synthesized `sha256(start|name|duration)` id. Decide at plan time after the capture.
- **Rate-limiting implementation (§7):** Vercel Firewall rate-limit rule on the route path (preferred, no app code, available on Pro) **vs.** a DB-window check in the route. Decide based on what Vercel Pro exposes; the firewall rule is lower-code if available.
- **Sleep field selection:** confirm which HAE sleep field maps to `sleep_hours` — `asleep` vs `totalSleep` (the aggregated sleep datum exposes both `totalSleep` and `asleep`). Pick `asleep` (time actually asleep) to match Whoop's sleep-duration semantics; confirm at capture.
- **"CONNECTED" definition:** a token exists vs. a token exists *and* ≥1 push received. Recommend: show `TOKEN SET` after generation, flip to `CONNECTED` only after `last_synced_at` is non-null (first push landed) — so the row honestly reflects whether data is flowing.
- **Health page display:** verify (as in the Whoop slice) the Health page already renders steps/weight/sleep/HRV/RHR from the latest `health_snapshots` row, so the only UI work is the new Settings token row. Confirm no rebuild.
