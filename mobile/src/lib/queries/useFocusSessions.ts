import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type FocusSessionRow = Database["public"]["Tables"]["focus_sessions"]["Row"];

export type ActiveFocusSession = {
  id: string;
  label: string;
  plannedMinutes: number;
  startedAt: string;
};

export type FocusTodayStats = {
  /** Count of sessions started today (started + still-running both count). */
  sessions: number;
  /** Sum of completed (ended) minutes for sessions started today. An
   * in-progress session's elapsed-so-far time is intentionally excluded —
   * it isn't a settled fact yet, and including it would make this drift
   * every render instead of only changing on refetch. */
  deepMinutes: number;
};

export type FocusWeekMinutePoint = { date: string; minutes: number };

export type UseFocusSessionsResult = {
  /** The newest session with `ended_at` null, or null when nothing is running. */
  active: ActiveFocusSession | null;
  todayStats: FocusTodayStats;
  /** Completed-minutes per day for the last 7 local days, oldest first, ending today. */
  weekMinutes: FocusWeekMinutePoint[];
  /** Consecutive local days (ending today-or-yesterday) with >=1 ended session. */
  streakDays: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Starts a new session. Enforces the one-active-session invariant
   * server-side: queries for this user's newest still-running session
   * (never trusts hook state, which can be stale) and ends it before
   * inserting the new one — mirrors `start_focus_session` in
   * `src/lib/assistant/tools.ts`. Refetches after insert. */
  start: (label: string, plannedMinutes: number) => Promise<void>;
  /** Sets `ended_at = now()` on the current active session, then refetches. */
  end: () => Promise<void>;
};

const LOOKBACK_DAYS = 60;
const WEEK_DAYS = 7;

/** YYYY-MM-DD in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The last `n` local dates as YYYY-MM-DD, oldest first, ending today. */
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(ymd(d));
  }
  return out;
}

/** Whole minutes between two ISO timestamps (never negative). */
function minutesBetween(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function mapActive(row: FocusSessionRow): ActiveFocusSession {
  return { id: row.id, label: row.label, plannedMinutes: row.planned_minutes, startedAt: row.started_at };
}

/** Newest row with `ended_at` null. Rows are expected pre-sorted newest-first. */
function findActive(rows: FocusSessionRow[]): FocusSessionRow | null {
  return rows.find((r) => r.ended_at === null) ?? null;
}

function computeTodayStats(rows: FocusSessionRow[], todayKey: string): FocusTodayStats {
  const todays = rows.filter((r) => ymd(new Date(r.started_at)) === todayKey);
  const deepMinutes = todays
    .filter((r): r is FocusSessionRow & { ended_at: string } => r.ended_at !== null)
    .reduce((sum, r) => sum + minutesBetween(r.started_at, r.ended_at), 0);
  return { sessions: todays.length, deepMinutes };
}

function computeWeekMinutes(rows: FocusSessionRow[], dates: string[]): FocusWeekMinutePoint[] {
  const minutesByDate = new Map<string, number>();
  for (const row of rows) {
    if (row.ended_at === null) continue;
    const key = ymd(new Date(row.started_at));
    minutesByDate.set(key, (minutesByDate.get(key) ?? 0) + minutesBetween(row.started_at, row.ended_at));
  }
  return dates.map((date) => ({ date, minutes: minutesByDate.get(date) ?? 0 }));
}

/** Consecutive local days (ending today-or-yesterday) with >=1 ended session
 * — today not yet having one still counts if yesterday does, matching
 * useJournal.ts's `computeDayStreak` "alive streak" semantics. */
function computeStreakDays(rows: FocusSessionRow[]): number {
  const doneDates = new Set(rows.filter((r) => r.ended_at !== null).map((r) => ymd(new Date(r.started_at))));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!doneDates.has(ymd(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!doneDates.has(ymd(cursor))) return 0;
  }
  let streak = 0;
  while (doneDates.has(ymd(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Focus sessions (read + write). Fetches the last `LOOKBACK_DAYS` days of
 * sessions once and derives `active` / `todayStats` / `weekMinutes` /
 * `streakDays` from that set. `start()` ends any pre-existing active session
 * (queried server-side, not from hook state) before inserting (user_id from
 * `auth.getUser()`) and refetches; `end()` sets `ended_at = now()` on the
 * current `active` row and refetches.
 */
export function useFocusSessions(): UseFocusSessionsResult {
  const [rows, setRows] = useState<FocusSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    const { data, error: err } = await supabase
      .from("focus_sessions")
      .select("*")
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false });

    if (err) {
      setError(err.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const start = useCallback(
    async (label: string, plannedMinutes: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }

      // Product invariant: only one active focus session at a time. Query
      // server-side for this user's newest still-running session — don't
      // trust `rows`/`active` from hook state, it can be stale — and end it
      // before inserting the new one, so a stray start() never leaves two
      // sessions open. Mirrors `start_focus_session` in
      // `src/lib/assistant/tools.ts`.
      const { data: active, error: findErr } = await supabase
        .from("focus_sessions")
        .select("id")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr) {
        setError(findErr.message);
        return;
      }

      if (active) {
        const { error: endErr } = await supabase
          .from("focus_sessions")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", active.id)
          .eq("user_id", user.id);
        if (endErr) {
          setError(endErr.message);
          return;
        }
      }

      const { error: err } = await supabase
        .from("focus_sessions")
        .insert({ user_id: user.id, label, planned_minutes: plannedMinutes });
      if (err) {
        setError(err.message);
        return;
      }
      await refetch();
    },
    [refetch],
  );

  const end = useCallback(async () => {
    const active = findActive(rows);
    if (!active) {
      setError("No active focus session to end");
      return;
    }
    const { error: err } = await supabase
      .from("focus_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    if (err) {
      setError(err.message);
      return;
    }
    await refetch();
  }, [rows, refetch]);

  const dates = lastNDates(WEEK_DAYS);
  const todayKey = dates[dates.length - 1];
  const activeRow = findActive(rows);

  return {
    active: activeRow ? mapActive(activeRow) : null,
    todayStats: computeTodayStats(rows, todayKey),
    weekMinutes: computeWeekMinutes(rows, dates),
    streakDays: computeStreakDays(rows),
    loading,
    error,
    refetch,
    start,
    end,
  };
}
