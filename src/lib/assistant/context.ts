import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isoDaysAgo } from "@/lib/format";

/**
 * Assembles "what does the assistant know about today" for a user — one
 * batch of reads across health, calendar, tasks, habits, focus, money, the
 * latest workout, and the journal streak. Consumed by:
 * - the `get_today_overview` tool (returns `.context` directly), and
 * - the assistant's system prompt (via `.promptText`), assembled once per
 *   request rather than re-derived per tool call.
 *
 * NOT server-only tagged (unlike model.ts/auth.ts): this module is unit
 * tested directly (see `__tests__/context.test.ts`), and the `server-only`
 * package unconditionally throws outside a Next.js RSC bundler context (it
 * only no-ops under the `react-server` export condition), which would break
 * `vitest`. Callers only ever reach this from server routes anyway.
 */

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Timezone / local-day helpers
//
// health_snapshots / habit_logs key off a plain `date` column, and "today"
// for a human is a LOCAL calendar day, not a UTC one — mirrors the technique
// in `src/lib/whoop/health.ts` (`whoopDayDate`), generalized here to also
// produce UTC instant bounds for timestamp-column queries (calendar_events,
// focus_sessions). An invalid/unrecognized IANA zone falls back to UTC
// rather than throwing, same as `whoopDayDate`.
// ---------------------------------------------------------------------------

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date (YYYY-MM-DD) for `instant` in `timeZone`. */
export function localDateString(instant: Date, timeZone: string): string {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** `dateStr` (YYYY-MM-DD) shifted by `deltaDays` calendar days — pure string
 * arithmetic (treats the date as a UTC instant, which is safe because we
 * never read a time-of-day component back out of it). */
export function shiftLocalDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

/** UTC offset (minutes) of `timeZone` at `instant` — e.g. -240 for EDT. */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUTC - instant.getTime()) / 60_000;
}

/** UTC instant bounds `[start, end)` for `dateStr` (YYYY-MM-DD) as a local
 * calendar day in `timeZone`. Offset is sampled once at local midnight —
 * accurate except for the rare day a DST transition itself falls exactly at
 * midnight, which is an acceptable trade-off for a "today" summary. */
export function localDayBoundsUTC(
  dateStr: string,
  timeZone: string,
): { startISO: string; endISO: string } {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const naiveUTC = new Date(`${dateStr}T00:00:00Z`).getTime();
  const offsetMin = offsetMinutesAt(new Date(naiveUTC), safeZone);
  const startMs = naiveUTC - offsetMin * 60_000;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startISO: new Date(startMs).toISOString(), endISO: new Date(endMs).toISOString() };
}

/** 12-hour clock label ("9:05 AM") for an ISO timestamp in `timeZone`. */
function formatClock12h(iso: string, timeZone: string): string {
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Reads the caller's IANA timezone off `profiles.timezone`, defaulting to
 * "UTC" when the row/column is absent (matches the column's own DB default). */
export async function resolveTimeZone(supabase: Client, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.timezone || "UTC";
}

// ---------------------------------------------------------------------------
// Money summary
//
// accounts grouped CASH (BANK/HYSA/T_BILLS) / INVESTED (EQUITY/RETIRE/CRYPTO/
// PRIVATE) / DEBT (current_value < 0, regardless of type); net worth = sum
// current_value; month burn = |sum of negative transactions this calendar
// month|; budget = budgets row for the current month.
// ---------------------------------------------------------------------------

const CASH_TYPES = new Set(["BANK", "HYSA", "T_BILLS"]);

export interface MoneyGroupTotals {
  cash: number;
  invested: number;
  /** Sum of negative-balance accounts. Zero or negative. */
  debt: number;
}

export interface TransactionBrief {
  id: string;
  name: string;
  amount: number;
  category: string;
  occurredAt: string;
}

export interface MoneySummary {
  netWorth: number;
  groups: MoneyGroupTotals;
  /** Absolute value of this calendar month's net outflow so far. */
  monthBurn: number;
  /** This month's budget amount, or null when none is set. */
  budget: number | null;
  /** Most recent transactions (capped at 4 — for the "today" context; the
   * `get_transactions` tool is used for longer/full history). */
  recentTransactions: TransactionBrief[];
}

/** Classifies one `finance_accounts` row into a money group. A negative
 * balance always reads as DEBT regardless of the account's declared type
 * (e.g. an overdrawn BANK account). */
function classifyAccount(account: { type: string; current_value: number }): keyof MoneyGroupTotals {
  if (account.current_value < 0) return "debt";
  return CASH_TYPES.has(account.type) ? "cash" : "invested";
}

export async function computeMoneySummary(supabase: Client, userId: string): Promise<MoneySummary> {
  const timeZone = await resolveTimeZone(supabase, userId);
  const today = localDateString(new Date(), timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { startISO: monthStartISO } = localDayBoundsUTC(monthStart, timeZone);
  const nextMonthStart = shiftLocalDate(monthStart, daysInMonth(monthStart));
  const { startISO: nextMonthStartISO } = localDayBoundsUTC(nextMonthStart, timeZone);

  const [accountsResult, monthTxResult, budgetResult, recentTxResult] = await Promise.all([
    supabase.from("finance_accounts").select("type,current_value").eq("user_id", userId),
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("occurred_at", monthStartISO)
      .lt("occurred_at", nextMonthStartISO),
    supabase.from("budgets").select("amount").eq("user_id", userId).eq("month", monthStart).maybeSingle(),
    supabase
      .from("transactions")
      .select("id,name,amount,category,occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(4),
  ]);

  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (monthTxResult.error) throw new Error(monthTxResult.error.message);
  if (budgetResult.error) throw new Error(budgetResult.error.message);
  if (recentTxResult.error) throw new Error(recentTxResult.error.message);

  const accounts = accountsResult.data ?? [];
  const groups: MoneyGroupTotals = { cash: 0, invested: 0, debt: 0 };
  let netWorth = 0;
  for (const account of accounts) {
    netWorth += account.current_value;
    groups[classifyAccount(account)] += account.current_value;
  }

  const monthOutflow = (monthTxResult.data ?? [])
    .map((t) => t.amount)
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum + amount, 0);

  return {
    netWorth,
    groups,
    monthBurn: Math.abs(monthOutflow),
    budget: budgetResult.data?.amount ?? null,
    recentTransactions: (recentTxResult.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      category: t.category,
      occurredAt: t.occurred_at,
    })),
  };
}

function daysInMonth(monthStart: string): number {
  const [year, month] = monthStart.split("-").map(Number);
  if (!year || !month) return 30;
  // Day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Today context
// ---------------------------------------------------------------------------

export interface HealthToday {
  date: string;
  sleepScore: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
  strain: number | null;
  hrv: number | null;
  rhr: number | null;
  steps: number | null;
  weight: number | null;
  weightUnit: string;
}

export interface CalendarEventBrief {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string;
}

export interface TaskBrief {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
}

export interface HabitStatusBrief {
  id: string;
  name: string;
  done: boolean;
}

export interface FocusSessionBrief {
  id: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
}

export interface WorkoutBrief {
  id: string;
  sport: string;
  startedAt: string;
  durationSec: number | null;
  distanceM: number | null;
  avgHr: number | null;
  strain: number | null;
}

export interface TodayContext {
  date: string;
  timeZone: string;
  health: HealthToday | null;
  calendarEvents: CalendarEventBrief[];
  tasks: { dueToday: TaskBrief[]; overdue: TaskBrief[] };
  habits: HabitStatusBrief[];
  focus: { active: FocusSessionBrief | null; today: FocusSessionBrief[] };
  money: MoneySummary;
  latestWorkout: WorkoutBrief | null;
  /** Consecutive local days (ending today, or yesterday if today has no
   * entry yet) with at least one journal entry. */
  journalStreak: number;
}

export interface TodayContextResult {
  context: TodayContext;
  /** Compact plain-text rendering of `context`, for injection into the
   * assistant's system prompt. */
  promptText: string;
}

function mapFocusRow(
  row: Database["public"]["Tables"]["focus_sessions"]["Row"],
): FocusSessionBrief {
  return {
    id: row.id,
    label: row.label,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    plannedMinutes: row.planned_minutes,
  };
}

export async function buildTodayContext(
  supabase: Client,
  userId: string,
): Promise<TodayContextResult> {
  const timeZone = await resolveTimeZone(supabase, userId);
  const date = localDateString(new Date(), timeZone);
  const { startISO: todayStart, endISO: tomorrowStart } = localDayBoundsUTC(date, timeZone);
  const journalWindowStart = isoDaysAgo(120);

  const [
    healthResult,
    calendarResult,
    tasksResult,
    habitsResult,
    habitLogsResult,
    activeFocusResult,
    todayFocusResult,
    money,
    latestWorkoutResult,
    journalResult,
  ] = await Promise.all([
    supabase.from("health_snapshots").select("*").eq("user_id", userId).eq("date", date).maybeSingle(),
    supabase
      .from("calendar_events")
      .select("id,title,starts_at,ends_at,all_day,location")
      .eq("user_id", userId)
      .gte("starts_at", todayStart)
      .lt("starts_at", tomorrowStart)
      .order("starts_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id,title,due_at,priority")
      .eq("user_id", userId)
      .eq("done", false)
      .not("due_at", "is", null)
      .lt("due_at", tomorrowStart)
      .order("due_at", { ascending: true }),
    supabase.from("habits").select("id,name,position").eq("user_id", userId).eq("archived", false).order("position", { ascending: true }),
    supabase.from("habit_logs").select("habit_id,done").eq("user_id", userId).eq("date", date),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", todayStart)
      .lt("started_at", tomorrowStart)
      .order("started_at", { ascending: false }),
    computeMoneySummary(supabase, userId),
    supabase.from("workouts").select("id,sport,started_at,duration_sec,distance_m,avg_hr,strain").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("journal_entries").select("written_at").eq("user_id", userId).gte("written_at", journalWindowStart),
  ]);

  if (healthResult.error) throw new Error(healthResult.error.message);
  if (calendarResult.error) throw new Error(calendarResult.error.message);
  if (tasksResult.error) throw new Error(tasksResult.error.message);
  if (habitsResult.error) throw new Error(habitsResult.error.message);
  if (habitLogsResult.error) throw new Error(habitLogsResult.error.message);
  if (activeFocusResult.error) throw new Error(activeFocusResult.error.message);
  if (todayFocusResult.error) throw new Error(todayFocusResult.error.message);
  if (latestWorkoutResult.error) throw new Error(latestWorkoutResult.error.message);
  if (journalResult.error) throw new Error(journalResult.error.message);

  const health: HealthToday | null = healthResult.data
    ? {
        date: healthResult.data.date,
        sleepScore: healthResult.data.sleep_score,
        sleepHours: healthResult.data.sleep_hours,
        recoveryScore: healthResult.data.recovery_score,
        strain: healthResult.data.strain,
        hrv: healthResult.data.hrv,
        rhr: healthResult.data.rhr,
        steps: healthResult.data.steps,
        weight: healthResult.data.weight,
        weightUnit: healthResult.data.weight_unit,
      }
    : null;

  const calendarEvents: CalendarEventBrief[] = (calendarResult.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    allDay: e.all_day,
    location: e.location,
  }));

  const dueTasks = tasksResult.data ?? [];
  const dueToday: TaskBrief[] = [];
  const overdue: TaskBrief[] = [];
  const todayStartMs = new Date(todayStart).getTime();
  for (const t of dueTasks) {
    const brief: TaskBrief = { id: t.id, title: t.title, dueAt: t.due_at, priority: t.priority };
    // Parse (not string-compare) — Postgres/PostgREST and our own
    // JS-generated ISO strings don't always share the same offset
    // representation even when both denote the same UTC instant.
    if (t.due_at && new Date(t.due_at).getTime() < todayStartMs) overdue.push(brief);
    else dueToday.push(brief);
  }

  const doneHabitIds = new Set(
    (habitLogsResult.data ?? []).filter((l) => l.done).map((l) => l.habit_id),
  );
  const habits: HabitStatusBrief[] = (habitsResult.data ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    done: doneHabitIds.has(h.id),
  }));

  const focus = {
    active: activeFocusResult.data ? mapFocusRow(activeFocusResult.data) : null,
    today: (todayFocusResult.data ?? []).map(mapFocusRow),
  };

  const latestWorkout: WorkoutBrief | null = latestWorkoutResult.data
    ? {
        id: latestWorkoutResult.data.id,
        sport: latestWorkoutResult.data.sport,
        startedAt: latestWorkoutResult.data.started_at,
        durationSec: latestWorkoutResult.data.duration_sec,
        distanceM: latestWorkoutResult.data.distance_m,
        avgHr: latestWorkoutResult.data.avg_hr,
        strain: latestWorkoutResult.data.strain,
      }
    : null;

  const journalDates = new Set(
    (journalResult.data ?? []).map((r) => localDateString(new Date(r.written_at), timeZone)),
  );
  let journalStreak = 0;
  let cursor = journalDates.has(date) ? date : shiftLocalDate(date, -1);
  while (journalDates.has(cursor)) {
    journalStreak += 1;
    cursor = shiftLocalDate(cursor, -1);
  }

  const context: TodayContext = {
    date,
    timeZone,
    health,
    calendarEvents,
    tasks: { dueToday, overdue },
    habits,
    focus,
    money,
    latestWorkout,
    journalStreak,
  };

  return { context, promptText: renderContextPrompt(context) };
}

/** Compact plain-text rendering of a `TodayContext`, for the assistant's
 * system prompt. 12-hour clock times throughout (global time-format rule). */
export function renderContextPrompt(context: TodayContext): string {
  const lines: string[] = [`Today: ${context.date} (${context.timeZone})`];

  if (context.health) {
    const h = context.health;
    const parts: string[] = [];
    if (h.recoveryScore != null) parts.push(`recovery ${h.recoveryScore}%`);
    if (h.sleepHours != null) parts.push(`sleep ${h.sleepHours}h${h.sleepScore != null ? ` (score ${h.sleepScore})` : ""}`);
    if (h.hrv != null) parts.push(`HRV ${h.hrv}`);
    if (h.rhr != null) parts.push(`RHR ${h.rhr}`);
    if (h.strain != null) parts.push(`strain ${h.strain}`);
    if (h.steps != null) parts.push(`${h.steps} steps`);
    if (h.weight != null) parts.push(`weight ${h.weight}${h.weightUnit}`);
    lines.push(`Health: ${parts.length ? parts.join(", ") : "logged, no metrics yet"}`);
  } else {
    lines.push("Health: no data logged today");
  }

  if (context.calendarEvents.length) {
    const events = context.calendarEvents
      .map((e) => `${e.allDay ? "all-day" : formatClock12h(e.startsAt, context.timeZone)} ${e.title}`)
      .join("; ");
    lines.push(`Calendar: ${events}`);
  } else {
    lines.push("Calendar: nothing scheduled today");
  }

  const taskLines: string[] = [];
  for (const t of context.tasks.overdue) taskLines.push(`OVERDUE: ${t.title}`);
  for (const t of context.tasks.dueToday) {
    taskLines.push(t.dueAt ? `${t.title} (due ${formatClock12h(t.dueAt, context.timeZone)})` : t.title);
  }
  lines.push(taskLines.length ? `Tasks: ${taskLines.join("; ")}` : "Tasks: nothing due today");

  if (context.habits.length) {
    const habitLines = context.habits.map((h) => `${h.name} ${h.done ? "✓" : "✗"}`).join(", ");
    lines.push(`Habits: ${habitLines}`);
  } else {
    lines.push("Habits: none set up");
  }

  if (context.focus.active) {
    lines.push(
      `Focus: active "${context.focus.active.label}" (${context.focus.active.plannedMinutes} min planned, started ${formatClock12h(context.focus.active.startedAt, context.timeZone)})`,
    );
  } else if (context.focus.today.length) {
    lines.push(`Focus: no active session; ${context.focus.today.length} session(s) today`);
  } else {
    lines.push("Focus: no sessions today");
  }

  const m = context.money;
  const budgetLabel = m.budget != null ? `${m.monthBurn.toFixed(0)} of ${m.budget.toFixed(0)} budget` : `${m.monthBurn.toFixed(0)} burned, no budget set`;
  const recent = m.recentTransactions.map((t) => `${t.name} ${t.amount >= 0 ? "+" : ""}${t.amount.toFixed(0)}`).join(", ");
  lines.push(
    `Money: net worth ${m.netWorth.toFixed(0)} (cash ${m.groups.cash.toFixed(0)}, invested ${m.groups.invested.toFixed(0)}, debt ${m.groups.debt.toFixed(0)}) | month ${budgetLabel}${recent ? ` | recent: ${recent}` : ""}`,
  );

  if (context.latestWorkout) {
    const w = context.latestWorkout;
    const bits = [w.sport || "workout"];
    if (w.durationSec != null) bits.push(`${Math.round(w.durationSec / 60)} min`);
    if (w.distanceM != null) bits.push(`${(w.distanceM / 1609.34).toFixed(1)} mi`);
    if (w.avgHr != null) bits.push(`avg HR ${w.avgHr}`);
    lines.push(`Latest workout: ${bits.join(", ")}`);
  } else {
    lines.push("Latest workout: none logged");
  }

  lines.push(`Journal streak: ${context.journalStreak} day${context.journalStreak === 1 ? "" : "s"}`);

  return lines.join("\n");
}
