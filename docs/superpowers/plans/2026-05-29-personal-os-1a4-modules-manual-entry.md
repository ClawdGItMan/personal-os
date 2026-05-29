# Personal OS — Plan 1A.4: Modules Come Alive (real data + manual entry)

> **For agentic workers:** Executed inline by the lead agent with per-module verification (running unattended; module DB writes + interactive UX need careful integration). Each module is an independent file-set — when run attended, this plan also supports a parallel worktree wave (one agent per module). Steps use checkbox (`- [ ]`).

**Goal:** Replace each dashboard card's empty state with the operator's real data, and add a Zod-validated, RLS-protected manual-entry path for every module that needs one — so Personal OS becomes usable: add a task & check it off, toggle habits, log a meal, log weight, log a lift, add a finance account & update its balance, log followers, and capture journal entries.

**Architecture:** The "single write path" the spec mandates (§2.3) — every mutation is a Next Server Action, Zod-validated at the boundary, executed through the RLS-protected Supabase server client (so `user_id = auth.uid()` is enforced by Postgres), followed by `revalidatePath('/dashboard')`. Reads happen in async Server Component cards. Interactive bits (toggles, forms) are small Client sub-components; instant feedback uses React 19's built-in `useOptimistic` (no SWR dependency this phase). Center cards self-fetch (rendered directly by the server dashboard page). Left-rail cards (Finance, Tasks) use a slot pattern so the client `LeftRail` can host server-fetched cards.

**Tech Stack:** Next 16 App Router, React 19 (`useOptimistic`), Tailwind 4, TypeScript strict, Supabase RLS. **New dep: `zod` only** (SWR deferred — React 19 native primitives cover Phase 1A).

**Spec reference:** spec §2.3 (single write path), §3 (data model), §5.4 (state/data). Design: `design_handoff_personal_os/prototype/app/{components-modules,data}.{jsx,js}`.

---

## Module → table → entry map

| Card | Table(s) | Manual entry (1A.4) | Read |
|---|---|---|---|
| 04 Tasks | `tasks` | add task (title, optional star); toggle `done` | today's open + starred |
| 05 Habits | `habits`, `habit_logs` | toggle today's habit; add habit | habits + today's logs → score |
| 07 Nutrition | `nutrition_entries` | log meal (desc, kcal, P/C/F) | today's entries → kcal/macros |
| 08 Health | `health_snapshots` | log weight (+ unit) | latest snapshot |
| 09 Social | `social_followers` | log count per platform | latest per platform → total |
| 10 Training | `training_sessions`, `lifts` | start session; log lift (name, wt, reps, sets, PR) | today's session + lifts |
| 03 Finance | `finance_accounts`, `finance_snapshots` | add account; update balance (writes snapshot) | accounts → net worth + sparkline |
| 02 Session (capture) | `journal_entries` | capture text → journal entry | — (write-only here) |
| 01 Operator | `profiles` | (done in 1A.3; settings edit in 1A.5) | — |
| 06 Calendar / 12 Inbox | — | deferred to 1B (integration-fed) | empty |

---

## Conventions for every server action

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";

const Schema = z.object({ /* ... */ });

export async function actionName(input: unknown): Promise<ActionResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("<table>").insert({ user_id: userId, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- **Always** set `user_id` explicitly AND rely on RLS (defense in depth).
- Validate with Zod `safeParse`; never throw raw to the client.
- `revalidatePath('/dashboard')` after every write (also the page the card lives on).
- Actions live in `src/app/(app)/_actions/<module>.ts`.

---

## Wave 0 — Serial prereq (lead agent, before any module)

### Task 0: deps + shared helpers + LeftRail slot refactor

- [ ] `pnpm add zod`
- [ ] `src/lib/auth.ts`:

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
});
```

- [ ] `src/lib/action-result.ts`:

```ts
export type ActionResult = { ok: true } | { ok: false; error: string };
```

- [ ] **Refactor `LeftRail` to a slot pattern** (so the client rail can host async server cards). `LeftRail` becomes: `function LeftRail({ operator, financeSlot, tasksSlot }: { operator: Operator; financeSlot: ReactNode; tasksSlot: ReactNode })` — renders `<OperatorCard operator>` (sync, still imported), then on `/dashboard` `financeSlot` else the QuickSwitch card, then `tasksSlot`. Update `(app)/layout.tsx` to render `<LeftRail operator={op} financeSlot={<FinancePulseCard/>} tasksSlot={<TasksCard/>} />`. (`OperatorCard` stays a sync prop component; `FinancePulseCard`/`TasksCard` become async server components consumed as slots.)
- [ ] Verify `pnpm tsc --noEmit && pnpm lint && pnpm build`. Commit: `chore: add zod, auth/action helpers, LeftRail slot refactor (1A.4)`.

---

## Wave 1 — Module builds (one section each; independent file-sets)

Each module = (a) async Server Component card that fetches + renders real data or an empty state; (b) a small Client entry component; (c) a Zod server action. Verify `tsc`/`lint` after each; commit per module.

### Task 1: Tasks (04) — add + toggle
- Files: `src/components/modules/TasksCard.tsx` (async, fetch open+starred today), `src/components/modules/tasks/TasksClient.tsx` (add input + checkbox list, `useOptimistic` on toggle), `src/app/(app)/_actions/tasks.ts` (`addTask`, `toggleTask`).
- Schema: `addTask` { title: z.string().min(1).max(200), star: z.boolean().default(false) }; `toggleTask` { id: z.string().uuid(), done: z.boolean() }.

### Task 2: Habits (05) — toggle today + add
- Files: `HabitsCard.tsx` (fetch habits + today's `habit_logs`, compute score N/total), `habits/HabitsClient.tsx` (grid of toggle buttons, sage-tint done), `_actions/habits.ts` (`addHabit`, `toggleHabitToday` — upsert `habit_logs` on `(habit_id, date)`).

### Task 3: Nutrition (07) — log meal
- Files: `NutritionCard.tsx` (sum today's kcal/macros, ring vs goal=2200 default), `nutrition/MealForm.tsx` (modal form), `_actions/nutrition.ts` (`logMeal`).

### Task 4: Health (08) — log weight
- Files: `HealthCard.tsx` (latest snapshot KPIs), `health/WeightForm.tsx`, `_actions/health.ts` (`logWeight` — upsert `health_snapshots` on `(user_id, date)`, source `manual`).

### Task 5: Social (09) — log count
- Files: `SocialCard.tsx` (latest per platform → total + rows), `social/FollowerForm.tsx` (platform select + count), `_actions/social.ts` (`logFollowers` — upsert on `(user_id, platform, date)`).

### Task 6: Training (10) — start session + log lift
- Files: `TrainCard.tsx` (today's session + lifts, PR pills), `train/LiftForm.tsx`, `_actions/training.ts` (`startSession`, `logLift` — PR detection: compare weight to prior max for same lift name).

### Task 7: Finance (03) — add account + update balance
- Files: `FinancePulseCard.tsx` (sum `current_value` → net worth; sparkline from `finance_snapshots`), `finance/AccountForm.tsx` (add), `finance/BalanceUpdate.tsx` (update → writes a snapshot), `_actions/finance.ts` (`addAccount`, `updateBalance`).

### Task 8: Capture (02) — journal entry
- Files: modify `SessionCard.tsx` (wire the existing capture bar form to the action via a client action handler), `_actions/capture.ts` (`capture` → insert `journal_entries`, source manual). Keep it dead-simple (no NLP routing this phase — capture = journal entry).

---

## Wave 2 — Verify + acceptance

- [ ] `pnpm tsc --noEmit` → 0; `pnpm lint` → 0; `pnpm build` → 0.
- [ ] `PORT=30xx pnpm test:e2e` → existing specs green (auth-gated entry flows can't be E2E-tested without a session seam; assert unauth redirects still hold + chrome renders).
- [ ] Code review (code-reviewer agent) on the diff; address Should-fix.
- [ ] **Manual seam (Max):** sign in → add a task, toggle a habit, log a meal/weight/lift, add an account, capture a journal note → confirm each persists across reload. (This is the real acceptance; note for Max.)

---

## Definition of Done (1A.4)

1. Every module in the table above shows the operator's real data (or a clean empty state) and supports its manual-entry action.
2. All writes go through Zod-validated server actions on the RLS-protected client; `revalidatePath` refreshes the UI.
3. `tsc`/`lint`/`build` clean; Playwright green; reviewed.
4. Only `zod` added; React 19 `useOptimistic` for instant toggles.

**On completion:** Plan 1A.5 builds the full secondary pages (Finance/Health/Train/Social/Journal) + a Settings page (profile, theme switcher, empty Connections section for 1B).
