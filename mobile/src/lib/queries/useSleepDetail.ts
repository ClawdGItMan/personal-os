import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";

/**
 * The latest `health_snapshots` row's sleep window + stage minutes, reshaped
 * for the Body sleep-detail surface. Every field is nullable because a given
 * day's sync may only cover some metrics (mirrors useHealthToday.ts).
 */
export type SleepDetail = {
  /** Snapshot date (ISO `YYYY-MM-DD`). */
  date: string;
  sleepStart: string | null;
  sleepEnd: string | null;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
  awakeMin: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
};

export type UseSleepDetailResult = {
  data: SleepDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const SLEEP_COLUMNS =
  "date,sleep_start,sleep_end,sleep_deep_min,sleep_rem_min,sleep_light_min,sleep_awake_min,sleep_hours,sleep_score";

/**
 * Reads the single most recent `health_snapshots` row for the signed-in user
 * (RLS-scoped, no manual `user_id` filter needed) and reshapes its sleep
 * columns. `data: null` (not an error) means no snapshot exists yet.
 */
export function useSleepDetail(): UseSleepDetailResult {
  const [data, setData] = useState<SleepDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data: row, error: err } = await supabase
      .from("health_snapshots")
      .select(SLEEP_COLUMNS)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setData(null);
      setLoading(false);
      return;
    }
    setData(
      row
        ? {
            date: row.date,
            sleepStart: row.sleep_start,
            sleepEnd: row.sleep_end,
            deepMin: row.sleep_deep_min,
            remMin: row.sleep_rem_min,
            lightMin: row.sleep_light_min,
            awakeMin: row.sleep_awake_min,
            sleepHours: row.sleep_hours,
            sleepScore: row.sleep_score,
          }
        : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
