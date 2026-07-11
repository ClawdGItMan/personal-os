import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ZodError } from "zod";
import { buildTools, buildToolExecutors, WRITE_TOOL_NAMES } from "@/lib/assistant/tools";
import { createFakeSupabase } from "./fake-supabase";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const VALID_UUID = "33333333-3333-4333-8333-333333333333";

// Single source for both "every tool the registry exposes" and "which of
// those are writes" — READ_TOOL_NAMES + [...WRITE_TOOL_NAMES] must partition
// ALL_TOOL_NAMES exactly, so a tool added to one list without the other (or
// left off both) fails loudly here instead of silently under/over-exposing
// `/act`.
const READ_TOOL_NAMES = [
  "get_today_overview",
  "get_health_history",
  "get_workouts",
  "get_calendar",
  "get_tasks",
  "get_money_summary",
  "get_transactions",
  "get_focus_history",
  "get_journal",
];
const ALL_TOOL_NAMES = [...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES];

describe("buildTools", () => {
  it("exposes exactly the tool names A3 depends on, each as a callable AI SDK tool", () => {
    const { client } = createFakeSupabase({});
    const tools = buildTools(client, USER_ID);
    expect(Object.keys(tools).sort()).toEqual([...ALL_TOOL_NAMES].sort());
    for (const name of ALL_TOOL_NAMES) {
      expect(typeof tools[name]?.execute).toBe("function");
      expect(typeof tools[name]?.description).toBe("string");
    }
  });
});

describe("WRITE_TOOL_NAMES", () => {
  it("matches exactly the 10 known write tools, and excludes every read tool", () => {
    expect([...WRITE_TOOL_NAMES].sort()).toEqual(
      [
        "create_task",
        "complete_task",
        "toggle_habit_today",
        "create_calendar_event",
        "start_focus_session",
        "end_focus_session",
        "log_journal",
        "add_transaction",
        "log_weight",
        "set_budget",
      ].sort(),
    );
    expect(WRITE_TOOL_NAMES.size).toBe(10);
    for (const readName of READ_TOOL_NAMES) {
      expect(WRITE_TOOL_NAMES.has(readName)).toBe(false);
    }
  });

  it("is a subset of every tool buildTools actually registers (no orphaned write name)", () => {
    const { client } = createFakeSupabase({});
    const tools = buildTools(client, USER_ID);
    for (const name of WRITE_TOOL_NAMES) {
      expect(Object.keys(tools)).toContain(name);
    }
  });
});

describe("buildToolExecutors — zod rejection at the /act boundary", () => {
  it("rejects create_task with an empty title", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.create_task?.({ title: "" })).rejects.toThrow(ZodError);
  });

  it("rejects complete_task with a non-UUID id", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.complete_task?.({ id: "not-a-uuid" })).rejects.toThrow(ZodError);
  });

  it("rejects start_focus_session with a non-positive planned_minutes", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.start_focus_session?.({ label: "Deep work", planned_minutes: 0 })).rejects.toThrow(
      ZodError,
    );
  });

  it("rejects log_weight with a negative weight", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.log_weight?.({ weight: -5 })).rejects.toThrow(ZodError);
  });

  it("rejects set_budget with a malformed month", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.set_budget?.({ month: "July 2026", amount: 4000 })).rejects.toThrow(ZodError);
  });

  it("rejects get_tasks with a scope outside the enum", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.get_tasks?.({ scope: "yesterday" })).rejects.toThrow(ZodError);
  });

  it("rejects get_calendar when from/to aren't ISO timestamps", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.get_calendar?.({ from: "not-a-date", to: "also-not" })).rejects.toThrow(ZodError);
  });

  it("applies the days default (does not reject) when get_health_history is called with no args", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.get_health_history?.({})).resolves.toEqual([]);
  });
});

describe("write tools — row shapes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("create_task inserts a row scoped to the caller, defaults priority, and returns an undo pointer", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const result = (await executors.create_task?.({ title: "Buy milk" })) as {
      ok: true;
      summary: string;
      undo?: { table: string; id: string };
    };
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("Buy milk");
    expect(result.undo?.table).toBe("tasks");

    const rows = db.get("tasks") ?? [];
    expect(rows).toHaveLength(1);
    // priority is intentionally omitted from the insert when not supplied —
    // the DB column default ('normal') fills it; the fake store doesn't
    // implement column defaults, so we only assert what the app actually sends.
    expect(rows[0]).toMatchObject({ user_id: USER_ID, title: "Buy milk", due_at: null });
    expect(rows[0]?.priority).toBeUndefined();
  });

  it("complete_task only affects the caller's own row and reports not-found for someone else's", async () => {
    const { client, db } = createFakeSupabase({
      tasks: [{ id: VALID_UUID, user_id: OTHER_USER_ID, title: "Not yours", done: false, priority: "normal", due_at: null }],
    });
    const executors = buildToolExecutors(client, USER_ID);
    await expect(executors.complete_task?.({ id: VALID_UUID })).rejects.toThrow(/not found/i);
    // RLS-scoping simulation: the row is untouched.
    expect(db.get("tasks")?.[0]?.done).toBe(false);
  });

  it("toggle_habit_today inserts a log on first toggle and removes it on the second (no undo on removal)", async () => {
    const { client, db } = createFakeSupabase({
      habits: [{ id: VALID_UUID, user_id: USER_ID, name: "Meditate" }],
    });
    const executors = buildToolExecutors(client, USER_ID);

    const on = (await executors.toggle_habit_today?.({ habit_id: VALID_UUID })) as {
      summary: string;
      undo?: { table: string; id: string };
    };
    expect(on.summary).toContain("Marked");
    expect(on.undo?.table).toBe("habit_logs");
    expect(db.get("habit_logs")).toHaveLength(1);

    const off = (await executors.toggle_habit_today?.({ habit_id: VALID_UUID })) as {
      summary: string;
      undo?: { table: string; id: string };
    };
    expect(off.summary).toContain("Unmarked");
    expect(off.undo).toBeUndefined();
    expect(db.get("habit_logs")).toHaveLength(0);
  });

  it("add_transaction always tags source='agent' regardless of caller input", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await executors.add_transaction?.({ name: "Coffee", amount: -6 });
    const rows = db.get("transactions") ?? [];
    expect(rows[0]).toMatchObject({ user_id: USER_ID, name: "Coffee", amount: -6, source: "agent" });
  });

  it("log_weight partial-upserts today's health_snapshots row without clobbering other sources' columns", async () => {
    const { client, db } = createFakeSupabase({
      health_snapshots: [
        {
          id: "hs1",
          user_id: USER_ID,
          date: "2026-07-10",
          source: "whoop",
          recovery_score: 72,
          sleep_hours: 7.5,
          weight: null,
        },
      ],
    });
    const executors = buildToolExecutors(client, USER_ID);
    const result = (await executors.log_weight?.({ weight: 181.4 })) as { ok: true; summary: string };
    expect(result.ok).toBe(true);

    const rows = db.get("health_snapshots") ?? [];
    expect(rows).toHaveLength(1); // merged into the existing day, not a duplicate
    expect(rows[0]).toMatchObject({
      weight: 181.4,
      recovery_score: 72, // untouched — proves the merge doesn't null other sources' columns
      sleep_hours: 7.5,
    });
  });

  it("set_budget upserts on (user_id, month), normalizing a YYYY-MM input to the first of the month", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const first = (await executors.set_budget?.({ month: "2026-07", amount: 4000 })) as { summary: string };
    expect(first.summary).toContain("$4,000");
    const second = await executors.set_budget?.({ month: "2026-07-15", amount: 4500 });
    void second;

    const rows = db.get("budgets") ?? [];
    expect(rows).toHaveLength(1); // second call updated in place, didn't insert a duplicate
    expect(rows[0]).toMatchObject({ user_id: USER_ID, month: "2026-07-01", amount: 4500 });
  });

  it("start_focus_session tags source='assistant' (started_at/ended_at are left to the DB default/null)", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await executors.start_focus_session?.({ label: "Deep work", planned_minutes: 50 });
    const started = db.get("focus_sessions")?.[0];
    expect(started).toMatchObject({ source: "assistant", label: "Deep work", planned_minutes: 50 });
    expect(started?.ended_at).toBeFalsy();
  });

  it("start_focus_session auto-ends a pre-existing active session before starting the new one", async () => {
    const { client, db } = createFakeSupabase({
      focus_sessions: [
        {
          id: VALID_UUID,
          user_id: USER_ID,
          label: "Old work",
          started_at: "2026-07-10T11:00:00Z",
          ended_at: null,
          planned_minutes: 30,
        },
      ],
    });
    const executors = buildToolExecutors(client, USER_ID);
    const result = (await executors.start_focus_session?.({ label: "New work", planned_minutes: 50 })) as {
      ok: true;
      summary: string;
      undo?: { table: string; id: string };
    };

    expect(result.summary).toBe("Ended previous session · Started 50 min: New work");

    const rows = db.get("focus_sessions") ?? [];
    expect(rows).toHaveLength(2); // old row kept (now ended), new row inserted — not overwritten
    const old = rows.find((r) => r.id === VALID_UUID);
    expect(old?.ended_at).toBeTruthy();
    const fresh = rows.find((r) => r.id !== VALID_UUID);
    expect(fresh).toMatchObject({ label: "New work", planned_minutes: 50 });
    expect(fresh?.ended_at).toBeFalsy();

    // undo points at the NEW session, not the one that got auto-ended
    expect(result.undo).toEqual({ table: "focus_sessions", id: fresh?.id });
  });

  it("start_focus_session with no active session starts plainly, unchanged from before", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const result = (await executors.start_focus_session?.({ label: "Deep work", planned_minutes: 50 })) as {
      summary: string;
    };
    expect(result.summary).toBe('Started focus session "Deep work" (50 min)');
    expect(db.get("focus_sessions")).toHaveLength(1);
  });

  it("end_focus_session ends the active session and computes elapsed minutes from its started_at", async () => {
    // Seeded directly (rather than chained off start_focus_session's insert)
    // because the fake store doesn't apply the real `started_at default
    // now()` column default the way Postgres does.
    const { client, db } = createFakeSupabase({
      focus_sessions: [
        {
          id: VALID_UUID,
          user_id: USER_ID,
          label: "Deep work",
          started_at: "2026-07-10T12:00:00Z",
          ended_at: null,
          planned_minutes: 50,
        },
      ],
    });
    const executors = buildToolExecutors(client, USER_ID);
    vi.setSystemTime(new Date("2026-07-10T12:25:00Z")); // +25 min after started_at
    const ended = (await executors.end_focus_session?.({})) as { summary: string; undo?: { table: string; id: string } };
    expect(ended.summary).toContain("25 min");
    expect(ended.undo).toEqual({ table: "focus_sessions", id: VALID_UUID });
    expect(db.get("focus_sessions")?.[0]?.ended_at).toBeTruthy();
  });

  it("end_focus_session is a no-op with no undo when there is no active session", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const result = (await executors.end_focus_session?.({})) as { ok: true; summary: string; undo?: unknown };
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/no active/i);
    expect(result.undo).toBeUndefined();
  });

  it("create_calendar_event always tags source='manual'", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    await executors.create_calendar_event?.({
      title: "Dentist",
      starts_at: "2026-07-11T14:00:00Z",
      ends_at: "2026-07-11T15:00:00Z",
    });
    expect(db.get("calendar_events")?.[0]).toMatchObject({ source: "manual", title: "Dentist" });
  });

  it("log_journal truncates a long entry in the summary but stores the full text", async () => {
    const { client, db } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const longText = "a".repeat(200);
    const result = (await executors.log_journal?.({ text: longText })) as { summary: string };
    expect(result.summary.length).toBeLessThan(longText.length);
    expect(db.get("journal_entries")?.[0]?.text).toBe(longText);
  });
});

describe("get_today_overview", () => {
  it("delegates to buildTodayContext and returns the typed context object", async () => {
    const { client } = createFakeSupabase({});
    const executors = buildToolExecutors(client, USER_ID);
    const context = (await executors.get_today_overview?.({})) as { date: string };
    expect(context.date).toBeDefined();
  });
});
