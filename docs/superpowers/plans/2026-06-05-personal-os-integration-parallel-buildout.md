# Personal OS — Parallel Integration Build-Out (Strava · Apple Health · Plaid)

> ℹ **2026-06-08 update.** The integrations below feed the shared backend, which is **reused by the
> new native iOS mobile app** (React Native + Swift) — see
> `2026-06-08-personal-os-native-mobile-app-design.md`. **Apple Health's portion of this plan is
> deprecated** (HAE → native HealthKit); Strava/Plaid backend work is unchanged.

> **Orchestration plan, not a product spec.** This coordinates how the next three integrations get
> designed in parallel *now* (while Whoop 1B.2 is built in a separate session) and built sequentially
> *later* (after the Whoop foundation merges). Each integration gets its own design spec + implementation
> plan; this doc is the map that ties them together and sets the order.
>
> **Created:** 2026-06-05 · **Branch:** `feature/integration-roadmap` (off `feature/1b2-whoop-health`)

---

## Context (committed thread)

Personal OS is integrations-first. Roadmap: **Whoop → Strava → Apple Health → Plaid** (order flexible).
1B.1a (Google Calendar) is **live in production**. Whoop (1B.2) is **spec'd, reviewer-approved, and queued
for a fresh-session build** — it is *blocked on Max's Whoop developer-app pre-flight*.

**Whoop is the keystone, not a peer.** The Whoop slice is the one that generalizes the shared foundation:
- Generalizes `src/lib/integrations/store.ts` → **provider-aware** token store (the spine every provider plugs into).
- Creates the **provider-agnostic `workouts` table** (`20260605120000_create_workouts.sql`).
- Replaces the Google-specific connection row with a generalized **`ProviderConnectionRow`**.
- Touches the shared spine: `vercel.json` (cron), `src/lib/env.ts`, `ConnectionsCard.tsx`,
  `_actions/connections.ts`, `database.types.ts`.

These are exactly the files every future provider also touches — so parallel *code builds* would collide on
them. The strategy below avoids that.

---

## The core principle

> **Parallelize the thinking, serialize the touching.**

- **Specs + pre-flight sign-ups** have no shared state → fully parallel, do them all now.
- **Edits to shared foundation files** must happen one branch at a time → sequence the builds after Whoop merges.

---

## Two-phase model

### Phase A — Parallel prep (NOW, while Whoop bakes)
Produce three **shovel-ready packages** + Max's pre-flight checklists. Everything here is new doc files and
real-world sign-ups — zero collision with the Whoop build.

A shovel-ready package (×3) =
1. **Pre-flight checklist** — Max's click-by-click: create dev app, scopes, redirect URIs, where the
   client ID/secret live, env-var names, and **approval lead time**. Max-only; the human-gated critical path.
2. **Design spec** → `docs/superpowers/specs/YYYY-MM-DD-personal-os-<provider>-design.md` — reviewer-approved
   (same 2-pass spec-document-reviewer loop Whoop got).
3. **Implementation plan** → `docs/superpowers/plans/YYYY-MM-DD-personal-os-<provider>.md` — task-by-task,
   mirroring the Whoop plan format, explicitly written to assume the **merged** Whoop foundation
   ("read the landed foundation code first").

### Phase B — Sequenced build fan-out (LATER, after Whoop merges to `main`)
Each integration is built in its own fresh subagent-driven session (the Whoop model), branching off an
updated `main`, gate-green + reviewed + merged **before the next starts**. Builds are sequential but fast
because the abstraction and the plans already exist.

---

## How the three specs get produced in parallel (this session)

1. **Resolve the real forks** — Max answers ~3 genuine product decisions (see "Open forks" below). Everything
   else uses the established Whoop/Google patterns.
2. **Dispatch 3 parallel subagents**, each drafting one spec from: fork decisions + the Whoop/Google spec as
   template + **current provider API docs verified against live sources** (training data is stale). They only
   *create new doc files* → no collision, and not the file-heavy work that stalled background agents last session.
3. **Reconcile + spec-reviewer loop** each draft; hand all three to Max to review by outcome.
4. **`writing-plans`** for each approved spec → the three implementation plans (also parallelizable).

---

## Per-integration foundation analysis

### Strava (build 1st — near-clone of Whoop)
- **Auth:** OAuth2 authorization-code + refresh (verify current refresh-token rotation behavior against live docs).
- **Data:** writes to the **existing `workouts` table** Whoop creates. Single stream (workouts only).
- **Foundation impact:** *tiny* — add a provider via the generalized store + `ProviderConnectionRow`; the
  Train "Activity" section already exists. Reuses Whoop's sync-core pattern almost verbatim.
- **Why first:** lowest risk, proves the multi-provider abstraction immediately on freshly-merged code.

### Apple Health (build 2nd — different ingestion model)
- **Auth:** **NOT OAuth.** The iOS "Health Auto Export" app **pushes** JSON to a configured REST endpoint on a
  schedule. Connection = a generated ingest token shown in Settings, not an OAuth redirect.
- **Data:** writes daily metrics into `health_snapshots` (**partial-merge**, same as Whoop) + workouts into
  `workouts`. Shares Whoop's mapper/upsert layer.
- **Foundation impact:** new **inbound ingest route** + **shared-secret/device-token auth** + a non-OAuth
  connection representation. Barely touches the OAuth store → nearly drift-proof vs. Whoop.

### Plaid (build 3rd — most new surface, longest approval)
- **Auth:** Plaid **Link** flow (client widget → `public_token` → server exchange → long-lived `item` access
  token). Different connection UX from OAuth redirect.
- **Data:** **new tables** — `plaid_items` (item/access-token store) + `transactions`; balances can update the
  existing finance `accounts` table (from 1A.4). Updates via `/transactions/sync` polling or webhooks.
- **Foundation impact:** *largest* — Plaid Link, item store, transactions model, webhook endpoint.
- **Why last:** most net-new surface and the most independent domain (money), so it benefits least from being
  early. **But its pre-flight starts first** (see below).

---

## Sequencing

**Build order (after Whoop merges):** Strava → Apple Health → Plaid.

**Pre-flight kickoff order (Max's sign-ups): Plaid → Strava → Apple Health.**
> Counter-intuitive but deliberate: pre-flight order is the *reverse* of build order. Plaid's production
> access needs an application/review with the longest real-world lead time, so its sign-up should start
> immediately even though it's built last. Kick off slow human-gated approvals first; build the easy code first.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Whoop foundation drifts during its build | Specs reference *locked patterns* (provider-aware store, `ProviderConnectionRow`, `workouts` table) from the approved Whoop plan; each impl plan says "read the merged code first." Apple Health & Plaid barely touch the OAuth store anyway. |
| Subagent stalls (last session's pain) | Spec-drafting is light, file-isolated work — not the file-heavy build work that stalled. If an agent stalls, finish that draft inline. No background workflows. |
| Plaid scope creep | Balances-vs-transactions fork decided up front; YAGNI'd hard. |
| Parallel-build collision on foundation files | Avoided by construction: builds are sequenced, each branch off updated `main`, merged before the next. |
| Stale provider API knowledge | Every spec verifies endpoints/scopes/field names against **live provider docs** before locking mappers. |

---

## Open forks (resolve before dispatching spec drafts)

1. **Plaid scope:** balances-only (cheap, updates existing accounts) **vs.** balances + full transaction history
   (rich, new `transactions` table, more cost + privacy surface)?
2. **Apple Health:** which metric set (sleep/HRV/RHR/steps/weight/workouts/…)? And ingest transport — direct
   REST POST to our app vs. file-drop?
3. **Strava:** confirm it's wanted, and scope (workouts only, or also segments/PR efforts)?

---

## Status tracker

- [x] Forks resolved (Max): Plaid = balances + transactions; Apple Health = core metrics via REST push; Strava = workouts only
- [x] Strava: spec ✅ → reviewed ✅ (Approved) → plan ☐
- [x] Apple Health: spec ✅ → reviewed ✅ (Approved) → plan ☐
- [x] Plaid: spec ✅ → reviewed ✅ (Approved) → plan ☐
- [ ] Pre-flight checklists delivered (Plaid → Strava → Apple Health)
- [ ] All three packages reviewed by Max (shovel-ready)
- [ ] — Whoop merges to `main` —
- [ ] Build Strava → merge
- [ ] Build Apple Health → merge
- [ ] Build Plaid → merge

## Spec review outcomes (2026-06-05) — all three Approved on first pass

Cross-cutting findings worth carrying into the plans:
- **Strava is zero-migration** — the `workouts` table already lists `'strava'` in its source check and has `distance_m` (pre-provisioned by Whoop). Pure provider-add.
- **Plaid finance schema was pre-wired** — the table is `finance_accounts` (not `accounts`) and already has a `plaid_account_id` column + `source ∈ {manual, plaid, coinbase}`. Balances need no migration; a partial-unique index on `(user_id, plaid_account_id)` keeps Plaid from clobbering manual rows.
- **Apple Health adds the only genuinely new foundation surface**: inbound ingest route + non-OAuth connection (per-user ingest token, SHA-256 hashed) + token-auth/abuse-protection. Needs new `hashToken`/`compareToken` helpers (crypto/tokens.ts is encrypt/decrypt only).
- **Advisory items folded into the plans:** Strava pagination cap (pick N) + local-dev callback-domain decision; Apple Health reuse-target assertion (Whoop must expose a reusable `workouts` upsert helper) + fixed-length digest compare; Plaid cursor-race concurrency guard (elevate to a required, tested task — silent financial failure mode) + dedicated Link row (the generalized `ProviderConnectionRow` assumes an `<a href>`, not a modal).
