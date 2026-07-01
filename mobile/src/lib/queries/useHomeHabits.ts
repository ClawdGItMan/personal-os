import { useEffect, useState } from "react";

import { supabase } from "../supabase";

export type HomeHabits = {
  /** Habits marked done in today's `habit_logs` (done = true). */
  done: number;
  /** Total non-archived habits. */
  total: number;
};

export type UseHomeHabits = {
  data: HomeHabits | null;
  loading: boolean;
  error: string | null;
};

/** Local calendar date as `YYYY-MM-DD` (matches the `date` column format). */
function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Home "Habits" vital: how many of today's non-archived habits are done.
 * Fetches the habit list and today's logs in parallel (both RLS-scoped to the
 * signed-in user), then counts habits whose log for today has `done = true`.
 * Returns `{ done: 0, total: 0 }` when the user has no habits yet.
 */
export function useHomeHabits(): UseHomeHabits {
  const [state, setState] = useState<UseHomeHabits>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const today = localToday();

    void Promise.all([
      supabase.from("habits").select("id").eq("archived", false),
      supabase.from("habit_logs").select("habit_id,done").eq("date", today),
    ]).then(([habitsRes, logsRes]) => {
      if (!active) return;
      const error = habitsRes.error ?? logsRes.error;
      if (error) {
        setState({ data: null, loading: false, error: error.message });
        return;
      }
      const habitIds = new Set((habitsRes.data ?? []).map((h) => h.id));
      const doneIds = new Set(
        (logsRes.data ?? [])
          .filter((log) => log.done && habitIds.has(log.habit_id))
          .map((log) => log.habit_id),
      );
      setState({
        data: { done: doneIds.size, total: habitIds.size },
        loading: false,
        error: null,
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
