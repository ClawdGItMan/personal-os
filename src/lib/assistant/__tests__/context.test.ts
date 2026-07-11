import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  localDateString,
  shiftLocalDate,
  localDayBoundsUTC,
  computeMoneySummary,
  buildTodayContext,
} from "@/lib/assistant/context";
import { createFakeSupabase } from "./fake-supabase";

const USER_ID = "11111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------------------
// Pure date/timezone helpers — same shape of coverage as whoopDayDate in
// src/lib/sync/stale.test.ts / whoop/health.test.ts: fixed instants, both
// directions of a local-day boundary crossing, and an invalid-zone fallback.
// ---------------------------------------------------------------------------

describe("localDateString", () => {
  it("assigns a post-midnight UTC instant to the local day it falls on (behind UTC)", () => {
    // 2026-06-05T02:30:00Z is 2026-06-04 22:30 local in America/New_York (EDT, UTC-4).
    expect(localDateString(new Date("2026-06-05T02:30:00Z"), "America/New_York")).toBe("2026-06-04");
  });

  it("assigns a later-in-day UTC instant to the same local day", () => {
    // 2026-06-05T15:00:00Z is 2026-06-05 11:00 local in America/New_York.
    expect(localDateString(new Date("2026-06-05T15:00:00Z"), "America/New_York")).toBe("2026-06-05");
  });

  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    expect(localDateString(new Date("2026-06-05T15:00:00Z"), "Not/AZone")).toBe("2026-06-05");
  });
});

describe("shiftLocalDate", () => {
  it("shifts forward across a month boundary", () => {
    expect(shiftLocalDate("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("shifts backward across a year boundary", () => {
    expect(shiftLocalDate("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("is a no-op for delta 0", () => {
    expect(shiftLocalDate("2026-07-10", 0)).toBe("2026-07-10");
  });
});

describe("localDayBoundsUTC", () => {
  it("returns a 24h [start, end) window", () => {
    const { startISO, endISO } = localDayBoundsUTC("2026-07-10", "America/New_York");
    expect(new Date(endISO).getTime() - new Date(startISO).getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("anchors local midnight to the correct UTC instant (EDT = UTC-4 in July)", () => {
    const { startISO } = localDayBoundsUTC("2026-07-10", "America/New_York");
    expect(startISO).toBe("2026-07-10T04:00:00.000Z");
  });

  it("falls back to UTC bounds for an invalid timezone", () => {
    const { startISO } = localDayBoundsUTC("2026-07-10", "Not/AZone");
    expect(startISO).toBe("2026-07-10T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// computeMoneySummary
// ---------------------------------------------------------------------------

describe("computeMoneySummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns zeroed totals and no budget when every table is empty", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
    });
    const summary = await computeMoneySummary(client, USER_ID);
    expect(summary).toEqual({
      netWorth: 0,
      groups: { cash: 0, invested: 0, debt: 0 },
      monthBurn: 0,
      budget: null,
      recentTransactions: [],
    });
  });

  it("groups accounts CASH/INVESTED/DEBT, treating a negative balance as DEBT regardless of type", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      finance_accounts: [
        { id: "a1", user_id: USER_ID, type: "BANK", current_value: 5000 },
        { id: "a2", user_id: USER_ID, type: "HYSA", current_value: 10000 },
        { id: "a3", user_id: USER_ID, type: "EQUITY", current_value: 20000 },
        { id: "a4", user_id: USER_ID, type: "CRYPTO", current_value: 3000 },
        // Overdrawn BANK account — must land in DEBT, not CASH.
        { id: "a5", user_id: USER_ID, type: "BANK", current_value: -800 },
      ],
    });
    const summary = await computeMoneySummary(client, USER_ID);
    // a5 (-800, type BANK) is DEBT, not CASH, so CASH is only a1+a2.
    expect(summary.groups).toEqual({ cash: 15000, invested: 23000, debt: -800 });
    expect(summary.netWorth).toBe(5000 + 10000 + 20000 + 3000 - 800);
  });

  it("computes month burn from negative transactions only, within the calendar month, and reads the matching budget row", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      transactions: [
        { id: "t1", user_id: USER_ID, name: "Rent", amount: -2000, category: "housing", occurred_at: "2026-07-01T00:00:00Z" },
        { id: "t2", user_id: USER_ID, name: "Paycheck", amount: 5000, category: "income", occurred_at: "2026-07-05T00:00:00Z" },
        { id: "t3", user_id: USER_ID, name: "Groceries", amount: -150, category: "food", occurred_at: "2026-07-09T00:00:00Z" },
        // Outside this calendar month — must not count toward burn.
        { id: "t4", user_id: USER_ID, name: "Old bill", amount: -999, category: "misc", occurred_at: "2026-06-15T00:00:00Z" },
      ],
      budgets: [{ id: "b1", user_id: USER_ID, month: "2026-07-01", amount: 4000 }],
    });
    const summary = await computeMoneySummary(client, USER_ID);
    expect(summary.monthBurn).toBe(2150);
    expect(summary.budget).toBe(4000);
  });

  it("caps recentTransactions at 4, most recent first", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      transactions: Array.from({ length: 6 }, (_, i) => ({
        id: `t${i}`,
        user_id: USER_ID,
        name: `Tx ${i}`,
        amount: -10,
        category: "",
        occurred_at: `2026-07-0${i + 1}T00:00:00Z`,
      })),
    });
    const summary = await computeMoneySummary(client, USER_ID);
    expect(summary.recentTransactions).toHaveLength(4);
    expect(summary.recentTransactions.map((t) => t.name)).toEqual(["Tx 5", "Tx 4", "Tx 3", "Tx 2"]);
  });
});

// ---------------------------------------------------------------------------
// buildTodayContext
// ---------------------------------------------------------------------------

describe("buildTodayContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns fully-defaulted values when every table is empty (no profile row either)", async () => {
    const { client } = createFakeSupabase({});
    const { context, promptText } = await buildTodayContext(client, USER_ID);

    expect(context.date).toBe("2026-07-10");
    expect(context.timeZone).toBe("UTC"); // default when profiles has no row
    expect(context.health).toBeNull();
    expect(context.calendarEvents).toEqual([]);
    expect(context.tasks).toEqual({ dueToday: [], overdue: [] });
    expect(context.habits).toEqual([]);
    expect(context.focus).toEqual({ active: null, today: [] });
    expect(context.money.netWorth).toBe(0);
    expect(context.latestWorkout).toBeNull();
    expect(context.journalStreak).toBe(0);

    expect(promptText).toContain("Today: 2026-07-10");
    expect(promptText).toContain("no data logged today");
  });

  it("splits open tasks into dueToday vs overdue by calendar day (not by time-of-day already passed)", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      tasks: [
        // Due earlier today (09:00Z, "now" is 12:00Z) — still "today", not overdue.
        { id: "task-today", user_id: USER_ID, title: "Standup notes", due_at: "2026-07-10T09:00:00Z", done: false, priority: "normal" },
        // Due yesterday — overdue.
        { id: "task-overdue", user_id: USER_ID, title: "Pay rent", due_at: "2026-07-09T09:00:00Z", done: false, priority: "high" },
        // Due tomorrow — excluded from both buckets.
        { id: "task-future", user_id: USER_ID, title: "Plan trip", due_at: "2026-07-11T09:00:00Z", done: false, priority: "low" },
        // Already done — excluded regardless of due date.
        { id: "task-done", user_id: USER_ID, title: "Old done task", due_at: "2026-07-09T09:00:00Z", done: true, priority: "low" },
        // No due date — excluded from the today/overdue split.
        { id: "task-no-due", user_id: USER_ID, title: "Someday", due_at: null, done: false, priority: "low" },
      ],
    });
    const { context } = await buildTodayContext(client, USER_ID);
    expect(context.tasks.dueToday.map((t) => t.id)).toEqual(["task-today"]);
    expect(context.tasks.overdue.map((t) => t.id)).toEqual(["task-overdue"]);
  });

  it("marks a habit done only when today's habit_logs row has done=true, and excludes archived habits", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      habits: [
        { id: "h1", user_id: USER_ID, name: "Meditate", position: 0, archived: false },
        { id: "h2", user_id: USER_ID, name: "Read", position: 1, archived: false },
        { id: "h3", user_id: USER_ID, name: "Retired habit", position: 2, archived: true },
      ],
      habit_logs: [{ id: "l1", user_id: USER_ID, habit_id: "h1", date: "2026-07-10", done: true }],
    });
    const { context } = await buildTodayContext(client, USER_ID);
    expect(context.habits).toEqual([
      { id: "h1", name: "Meditate", done: true },
      { id: "h2", name: "Read", done: false },
    ]);
  });

  it("computes journal streak counting back from yesterday when today has no entry yet", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      journal_entries: [
        { id: "j1", user_id: USER_ID, written_at: "2026-07-09T20:00:00Z", text: "yesterday" },
        { id: "j2", user_id: USER_ID, written_at: "2026-07-08T20:00:00Z", text: "day before" },
        // Gap on 07-07 — streak must stop here, not count 07-06.
        { id: "j3", user_id: USER_ID, written_at: "2026-07-06T20:00:00Z", text: "too old" },
      ],
    });
    const { context } = await buildTodayContext(client, USER_ID);
    expect(context.journalStreak).toBe(2);
  });

  it("counts today's entry as day 1 of the streak when present", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      journal_entries: [{ id: "j1", user_id: USER_ID, written_at: "2026-07-10T08:00:00Z", text: "today" }],
    });
    const { context } = await buildTodayContext(client, USER_ID);
    expect(context.journalStreak).toBe(1);
  });

  it("reports the most recent open focus session as active only when it has no ended_at", async () => {
    const { client } = createFakeSupabase({
      profiles: [{ id: USER_ID, timezone: "UTC" }],
      focus_sessions: [
        {
          id: "f1",
          user_id: USER_ID,
          label: "Deep work",
          started_at: "2026-07-10T11:30:00Z",
          ended_at: null,
          planned_minutes: 50,
        },
      ],
    });
    const { context } = await buildTodayContext(client, USER_ID);
    expect(context.focus.active?.id).toBe("f1");
    expect(context.focus.today.map((f) => f.id)).toEqual(["f1"]);
  });
});
