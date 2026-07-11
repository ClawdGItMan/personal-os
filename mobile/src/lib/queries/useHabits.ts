import { useCallback, useEffect, useState } from "react";

import type { Habit, HabitDot } from "../../data/focus";
import { fireSuccessHaptic } from "../../components/spec/Pressed";
import { supabase } from "../supabase";
import type { Database } from "../database.types";

type HabitModel = Database["public"]["Tables"]["habits"]["Row"];
type HabitLogModel = Database["public"]["Tables"]["habit_logs"]["Row"];

/** A habit ready for HabitRow, plus the id + today's done state for writes. */
export type FocusHabitItem = Habit & {
  id: string;
  /** Whether today's log is currently marked done (drives the toggle target). */
  todayDone: boolean;
};

export type UseHabitsResult = {
  data: FocusHabitItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Toggle today's log for a habit (upsert done, or set done=false to untoggle). */
  toggleHabitToday: (habitId: string, nextDone: boolean) => Promise<void>;
};

/** YYYY-MM-DD in local time for a Date. */
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

const LOOKBACK_DAYS = 14;
const WEEK_DOTS = 7;

/** Consecutive days (up to today) that are marked done in the done-by-date map. */
function currentStreak(doneByDate: Map<string, boolean>): number {
  let streak = 0;
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Walk backwards from today while each day is done.
  // Stop at the first non-done day.
  for (;;) {
    const key = ymd(cursor);
    if (doneByDate.get(key) === true) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** 7 dots for the last 7 dates: today is always the ring; past = done|empty. */
function weekDots(doneByDate: Map<string, boolean>): HabitDot[] {
  const dates = lastNDates(WEEK_DOTS);
  return dates.map((date, i) => {
    const isToday = i === dates.length - 1;
    if (isToday) return "today";
    return doneByDate.get(date) === true ? "done" : "empty";
  });
}

function streakLabel(streak: number): { streak: string; reset: boolean } {
  if (streak <= 0) return { streak: "Streak reset · 0", reset: true };
  return { streak: `${streak}-day streak`, reset: false };
}

function buildHabit(habit: HabitModel, logs: HabitLogModel[]): FocusHabitItem {
  const doneByDate = new Map<string, boolean>();
  for (const log of logs) doneByDate.set(log.date, log.done);
  const streak = currentStreak(doneByDate);
  const { streak: label, reset } = streakLabel(streak);
  const todayKey = ymd(new Date());
  return {
    id: habit.id,
    name: habit.name,
    streak: label,
    reset,
    dots: weekDots(doneByDate),
    todayDone: doneByDate.get(todayKey) === true,
  };
}

/**
 * Habits (read + write). Fetches non-archived habits (by position) plus their
 * logs for the last ~14 days, computing a current streak + 7 week-dots each.
 * `toggleHabitToday` upserts today's log on (habit_id, date), or sets done=false
 * to untoggle. Inserts require user_id (RLS insert policy checks auth.uid()).
 */
export function useHabits(): UseHabitsResult {
  const [data, setData] = useState<FocusHabitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data: habits, error: hErr } = await supabase
      .from("habits")
      .select("*")
      .eq("archived", false)
      .order("position", { ascending: true });

    if (hErr) {
      setError(hErr.message);
      setData([]);
      setLoading(false);
      return;
    }
    const habitRows = habits ?? [];
    if (habitRows.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const sinceDate = lastNDates(LOOKBACK_DAYS)[0];
    const habitIds = habitRows.map((h) => h.id);
    const { data: logs, error: lErr } = await supabase
      .from("habit_logs")
      .select("*")
      .in("habit_id", habitIds)
      .gte("date", sinceDate);

    if (lErr) {
      setError(lErr.message);
      setData([]);
      setLoading(false);
      return;
    }

    const logsByHabit = new Map<string, HabitLogModel[]>();
    for (const log of logs ?? []) {
      const list = logsByHabit.get(log.habit_id) ?? [];
      list.push(log);
      logsByHabit.set(log.habit_id, list);
    }

    setData(habitRows.map((h) => buildHabit(h, logsByHabit.get(h.id) ?? [])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const toggleHabitToday = useCallback(
    async (habitId: string, nextDone: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const today = ymd(new Date());

      // Optimistic local update: flip today's dot state for this habit.
      setData((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, todayDone: nextDone } : h)),
      );

      const { error: err } = await supabase
        .from("habit_logs")
        .upsert(
          { habit_id: habitId, user_id: user.id, date: today, done: nextDone },
          { onConflict: "habit_id,date" },
        );

      if (err) {
        // Revert on failure and surface the error.
        setData((prev) =>
          prev.map((h) => (h.id === habitId ? { ...h, todayDone: !nextDone } : h)),
        );
        setError(err.message);
        return;
      }
      fireSuccessHaptic();
      // Refetch so the streak + week-dots recompute from the source of truth.
      await refetch();
    },
    [refetch],
  );

  return { data, loading, error, refetch, toggleHabitToday };
}
