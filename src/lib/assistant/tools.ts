import { z } from "zod";
import { tool, type ToolSet } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isoDaysAgo, fmtUSD, fmtUSDDelta } from "@/lib/format";
import {
  buildTodayContext,
  computeMoneySummary,
  resolveTimeZone,
  localDateString,
  localDayBoundsUTC,
  shiftLocalDate,
} from "@/lib/assistant/context";

/**
 * The assistant's tool registry.
 *
 * NOT server-only tagged: this module is unit tested directly (see
 * `__tests__/tools.test.ts`) and the `server-only` package unconditionally
 * throws outside a Next.js RSC bundle, which would break `vitest`. Callers
 * only ever reach this from server routes (built on `getUserClientFromBearer`,
 * which IS server-only-tagged) anyway.
 *
 * Two entry points share one definition set (`buildToolDefs`):
 * - `buildTools(supabase, userId)` — an AI SDK v7 `ToolSet` (each entry built
 *   with `tool({ description, inputSchema, execute })` — v7/provider-utils
 *   v5, like v6, names the field `inputSchema`, not `parameters`) for the
 *   model to call during a chat turn.
 * - `buildToolExecutors(supabase, userId)` — the same execute logic as a
 *   plain `name -> (rawInput) => Promise<result>` map, for the `/act` route
 *   to invoke directly without any model involvement. Each executor
 *   re-validates its raw input against the tool's zod schema first — the
 *   model-driven path gets that validation for free from the AI SDK, so
 *   this keeps "validate at every boundary" true on both paths.
 */

type Client = SupabaseClient<Database>;

/** Contract every write tool returns, for the client to render a
 * confirmation card. `undo`, when present, names the row the write touched;
 * omitted when there's nothing sensible to point at (e.g. a delete, or a
 * shared multi-source row where a naive id-delete undo would be unsafe). */
export interface ToolWriteResult {
  ok: true;
  summary: string;
  undo?: { table: string; id: string };
}

/** Uniform internal shape every registry entry is erased to (see
 * `defineTool`), so `buildTools`/`buildToolExecutors` can iterate the
 * registry with one loop regardless of each tool's concrete input type. */
interface ToolDef {
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
}

/** Ties a concrete zod schema's inferred type to its execute function, then
 * erases both to the uniform `ToolDef` shape. The `input as T` cast inside is
 * sound at both call sites: `buildTools` only ever calls `execute` with a
 * value the AI SDK already validated against `inputSchema`, and
 * `buildToolExecutors` always runs `inputSchema.parse(raw)` before calling
 * `execute`. */
function defineTool<T>(def: {
  description: string;
  inputSchema: z.ZodType<T>;
  execute: (input: T) => Promise<unknown>;
}): ToolDef {
  return {
    description: def.description,
    inputSchema: def.inputSchema,
    execute: (input: unknown) => def.execute(input as T),
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

const daysInput = (max: number, fallback: number) =>
  z.object({ days: z.number().int().min(1).max(max).default(fallback) });

const isoTimestamp = () => z.iso.datetime({ offset: true });

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const GetTodayOverviewInput = z.object({});
const GetHealthHistoryInput = daysInput(90, 7);
const GetWorkoutsInput = daysInput(90, 7);
const GetCalendarInput = z.object({ from: isoTimestamp(), to: isoTimestamp() });
const GetTasksInput = z.object({ scope: z.enum(["today", "week", "all"]) });
const GetMoneySummaryInput = z.object({});
const GetTransactionsInput = daysInput(365, 30);
const GetFocusHistoryInput = daysInput(90, 7);
const GetJournalInput = daysInput(90, 7);

const CreateTaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  due_at: isoTimestamp().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});
const CompleteTaskInput = z.object({ id: z.uuid() });
const ToggleHabitTodayInput = z.object({ habit_id: z.uuid() });
const CreateCalendarEventInput = z.object({
  title: z.string().trim().min(1).max(200),
  starts_at: isoTimestamp(),
  ends_at: isoTimestamp(),
});
const StartFocusSessionInput = z.object({
  label: z.string().trim().min(1).max(100),
  planned_minutes: z.number().int().min(1).max(480),
});
const EndFocusSessionInput = z.object({});
const LogJournalInput = z.object({ text: z.string().trim().min(1).max(5000) });
const AddTransactionInput = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number().finite(),
  category: z.string().trim().max(100).optional(),
  occurred_at: isoTimestamp().optional(),
});
const LogWeightInput = z.object({ weight: z.number().positive().max(2000) });
const SetBudgetInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "month must be YYYY-MM or YYYY-MM-DD"),
  amount: z.number().finite(),
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

function buildToolDefs(supabase: Client, userId: string): Record<string, ToolDef> {
  return {
    // --- Reads --------------------------------------------------------

    get_today_overview: defineTool({
      description:
        "Get a full snapshot of today: health, calendar, tasks due/overdue, habit status, focus sessions, money summary, latest workout, and journal streak.",
      inputSchema: GetTodayOverviewInput,
      execute: async () => (await buildTodayContext(supabase, userId)).context,
    }),

    get_health_history: defineTool({
      description: "Get daily health snapshots (sleep, recovery, strain, HRV, RHR, steps, weight) for the last N days.",
      inputSchema: GetHealthHistoryInput,
      execute: async ({ days }) => {
        const { data, error } = await supabase
          .from("health_snapshots")
          .select("*")
          .eq("user_id", userId)
          .gte("date", isoDaysAgo(days))
          .order("date", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_workouts: defineTool({
      description: "Get logged workouts (sport, duration, distance, heart rate, strain) for the last N days.",
      inputSchema: GetWorkoutsInput,
      execute: async ({ days }) => {
        const { data, error } = await supabase
          .from("workouts")
          .select("*")
          .eq("user_id", userId)
          .gte("started_at", isoDaysAgo(days))
          .order("started_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_calendar: defineTool({
      description: "Get calendar events whose start time falls within [from, to] (ISO timestamps).",
      inputSchema: GetCalendarInput,
      execute: async ({ from, to }) => {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .gte("starts_at", from)
          .lte("starts_at", to)
          .order("starts_at", { ascending: true });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_tasks: defineTool({
      description:
        "Get open (not done) tasks. scope='today': due today or overdue. scope='week': due within the next 7 days (or overdue). scope='all': every open task, including ones with no due date.",
      inputSchema: GetTasksInput,
      execute: async ({ scope }) => {
        let query = supabase.from("tasks").select("*").eq("user_id", userId).eq("done", false);
        if (scope !== "all") {
          const timeZone = await resolveTimeZone(supabase, userId);
          const today = localDateString(new Date(), timeZone);
          const horizon = scope === "today" ? today : shiftLocalDate(today, 7);
          const { endISO } = localDayBoundsUTC(horizon, timeZone);
          query = query.lt("due_at", endISO);
        }
        const { data, error } = await query.order("due_at", { ascending: true });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_money_summary: defineTool({
      description: "Get net worth (grouped cash/invested/debt), this month's burn vs budget, and the 4 most recent transactions.",
      inputSchema: GetMoneySummaryInput,
      execute: async () => computeMoneySummary(supabase, userId),
    }),

    get_transactions: defineTool({
      description: "Get transactions from the last N days, most recent first.",
      inputSchema: GetTransactionsInput,
      execute: async ({ days }) => {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .gte("occurred_at", isoDaysAgo(days))
          .order("occurred_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_focus_history: defineTool({
      description: "Get focus sessions from the last N days, most recent first.",
      inputSchema: GetFocusHistoryInput,
      execute: async ({ days }) => {
        const { data, error } = await supabase
          .from("focus_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("started_at", isoDaysAgo(days))
          .order("started_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    get_journal: defineTool({
      description: "Get journal entries from the last N days, most recent first.",
      inputSchema: GetJournalInput,
      execute: async ({ days }) => {
        const { data, error } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("user_id", userId)
          .gte("written_at", isoDaysAgo(days))
          .order("written_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }),

    // --- Writes ---------------------------------------------------------

    create_task: defineTool({
      description: "Create a new task.",
      inputSchema: CreateTaskInput,
      execute: async ({ title, due_at, priority }): Promise<ToolWriteResult> => {
        const insert: Database["public"]["Tables"]["tasks"]["Insert"] = {
          user_id: userId,
          title,
          due_at: due_at ?? null,
        };
        if (priority) insert.priority = priority;
        const { data, error } = await supabase.from("tasks").insert(insert).select("id,title,due_at").single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Created task "${data.title}"${data.due_at ? ` (due ${new Date(data.due_at).toLocaleString()})` : ""}`,
          undo: { table: "tasks", id: data.id },
        };
      },
    }),

    complete_task: defineTool({
      description: "Mark a task done by id.",
      inputSchema: CompleteTaskInput,
      execute: async ({ id }): Promise<ToolWriteResult> => {
        const { data, error } = await supabase
          .from("tasks")
          .update({ done: true })
          .eq("id", id)
          .eq("user_id", userId)
          .select("id,title")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error(`Task not found: ${id}`);
        return { ok: true, summary: `Completed "${data.title}"`, undo: { table: "tasks", id: data.id } };
      },
    }),

    toggle_habit_today: defineTool({
      description: "Toggle a habit's done status for today (marks it done if not yet logged, unmarks it if already logged).",
      inputSchema: ToggleHabitTodayInput,
      execute: async ({ habit_id }): Promise<ToolWriteResult> => {
        const { data: habit, error: habitError } = await supabase
          .from("habits")
          .select("id,name")
          .eq("id", habit_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (habitError) throw new Error(habitError.message);
        if (!habit) throw new Error(`Habit not found: ${habit_id}`);

        const timeZone = await resolveTimeZone(supabase, userId);
        const today = localDateString(new Date(), timeZone);

        const { data: existingLog, error: logError } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("habit_id", habit_id)
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();
        if (logError) throw new Error(logError.message);

        if (existingLog) {
          const { error: deleteError } = await supabase.from("habit_logs").delete().eq("id", existingLog.id);
          if (deleteError) throw new Error(deleteError.message);
          // No `undo`: the log row is gone, there's nothing left to point at.
          return { ok: true, summary: `Unmarked "${habit.name}" for today` };
        }

        const { data: newLog, error: insertError } = await supabase
          .from("habit_logs")
          .insert({ user_id: userId, habit_id, date: today, done: true })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        return {
          ok: true,
          summary: `Marked "${habit.name}" done for today`,
          undo: { table: "habit_logs", id: newLog.id },
        };
      },
    }),

    create_calendar_event: defineTool({
      description: "Create a manual calendar event.",
      inputSchema: CreateCalendarEventInput,
      execute: async ({ title, starts_at, ends_at }): Promise<ToolWriteResult> => {
        const { data, error } = await supabase
          .from("calendar_events")
          .insert({ user_id: userId, title, starts_at, ends_at, source: "manual" })
          .select("id,title,starts_at")
          .single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Added "${data.title}" to your calendar at ${new Date(data.starts_at).toLocaleString()}`,
          undo: { table: "calendar_events", id: data.id },
        };
      },
    }),

    start_focus_session: defineTool({
      description: "Start a new focus session now.",
      inputSchema: StartFocusSessionInput,
      execute: async ({ label, planned_minutes }): Promise<ToolWriteResult> => {
        const { data, error } = await supabase
          .from("focus_sessions")
          .insert({ user_id: userId, label, planned_minutes, source: "assistant" })
          .select("id,label,planned_minutes")
          .single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Started focus session "${data.label}" (${data.planned_minutes} min)`,
          undo: { table: "focus_sessions", id: data.id },
        };
      },
    }),

    end_focus_session: defineTool({
      description: "End the currently active focus session (the most recent one with no end time), if any.",
      inputSchema: EndFocusSessionInput,
      execute: async (): Promise<ToolWriteResult> => {
        const { data: active, error: findError } = await supabase
          .from("focus_sessions")
          .select("id,label,started_at")
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (findError) throw new Error(findError.message);
        if (!active) return { ok: true, summary: "No active focus session to end." };

        const endedAt = new Date();
        const { data, error } = await supabase
          .from("focus_sessions")
          .update({ ended_at: endedAt.toISOString() })
          .eq("id", active.id)
          .select("id,label")
          .single();
        if (error) throw new Error(error.message);

        const minutes = Math.max(
          0,
          Math.round((endedAt.getTime() - new Date(active.started_at).getTime()) / 60_000),
        );
        return {
          ok: true,
          summary: `Ended focus session "${data.label}" (${minutes} min)`,
          undo: { table: "focus_sessions", id: data.id },
        };
      },
    }),

    log_journal: defineTool({
      description: "Log a new journal entry, timestamped now.",
      inputSchema: LogJournalInput,
      execute: async ({ text }): Promise<ToolWriteResult> => {
        const { data, error } = await supabase
          .from("journal_entries")
          .insert({ user_id: userId, text })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Logged journal entry: "${truncate(text, 60)}"`,
          undo: { table: "journal_entries", id: data.id },
        };
      },
    }),

    add_transaction: defineTool({
      description: "Log a manual transaction. Positive amount = inflow, negative = outflow.",
      inputSchema: AddTransactionInput,
      execute: async ({ name, amount, category, occurred_at }): Promise<ToolWriteResult> => {
        const insert: Database["public"]["Tables"]["transactions"]["Insert"] = {
          user_id: userId,
          name,
          amount,
          source: "agent",
        };
        if (category) insert.category = category;
        if (occurred_at) insert.occurred_at = occurred_at;
        const { data, error } = await supabase.from("transactions").insert(insert).select("id,name,amount").single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Logged transaction "${data.name}" ${fmtUSDDelta(data.amount)}`,
          undo: { table: "transactions", id: data.id },
        };
      },
    }),

    log_weight: defineTool({
      description: "Log today's body weight.",
      inputSchema: LogWeightInput,
      execute: async ({ weight }): Promise<ToolWriteResult> => {
        const timeZone = await resolveTimeZone(supabase, userId);
        const today = localDateString(new Date(), timeZone);
        // Partial column-merge upsert — mirrors `upsertHealthSnapshots` in
        // src/lib/sync/whoop.ts (not imported directly: that module is
        // tagged `server-only`, which unconditionally throws under vitest).
        // Only user_id/date/weight/source are sent, so today's other
        // sources' columns (sleep, recovery, ...) survive untouched.
        const { error } = await supabase
          .from("health_snapshots")
          .upsert({ user_id: userId, date: today, weight, source: "manual" }, { onConflict: "user_id,date" });
        if (error) throw new Error(error.message);
        // No `undo`: health_snapshots is a shared multi-source row — a naive
        // {table,id}-delete undo would destroy other sources' data for today.
        return { ok: true, summary: `Logged weight: ${weight}` };
      },
    }),

    set_budget: defineTool({
      description: "Set (or update) the spending budget for a given month.",
      inputSchema: SetBudgetInput,
      execute: async ({ month, amount }): Promise<ToolWriteResult> => {
        const normalizedMonth = `${month.slice(0, 7)}-01`;
        const { data, error } = await supabase
          .from("budgets")
          .upsert({ user_id: userId, month: normalizedMonth, amount }, { onConflict: "user_id,month" })
          .select("id,month,amount")
          .single();
        if (error) throw new Error(error.message);
        return {
          ok: true,
          summary: `Set budget for ${data.month.slice(0, 7)} to ${fmtUSD(data.amount)}`,
          undo: { table: "budgets", id: data.id },
        };
      },
    }),
  };
}

/** Builds the AI SDK `ToolSet` the model calls during a chat turn. */
export function buildTools(supabase: Client, userId: string): ToolSet {
  const defs = buildToolDefs(supabase, userId);
  const toolSet: ToolSet = {};
  for (const [name, def] of Object.entries(defs)) {
    toolSet[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: def.execute,
    });
  }
  return toolSet;
}

export type ToolExecutor = (rawInput: unknown) => Promise<unknown>;

/** Plain `name -> execute` map for the `/act` route to call directly,
 * without any model involvement. Each executor validates `rawInput` against
 * the tool's own zod schema before running (throws `ZodError` on failure). */
export function buildToolExecutors(supabase: Client, userId: string): Record<string, ToolExecutor> {
  const defs = buildToolDefs(supabase, userId);
  const executors: Record<string, ToolExecutor> = {};
  for (const [name, def] of Object.entries(defs)) {
    // `async` matters here, not just style: it converts a synchronous
    // `.parse()` throw (invalid input) into a rejected Promise, so this
    // always honors its `Promise<unknown>` return type rather than
    // sometimes throwing synchronously on the call expression itself.
    executors[name] = async (rawInput: unknown) => def.execute(def.inputSchema.parse(rawInput));
  }
  return executors;
}
