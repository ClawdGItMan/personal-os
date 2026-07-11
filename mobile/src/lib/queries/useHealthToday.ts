import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";

/**
 * Latest `health_snapshots` row (Whoop sync), reshaped for the Body + Home
 * surfaces. Every field is nullable because a given day's sync may only cover
 * some metrics — callers fall back to the mock for any `null`.
 */
export type HealthToday = {
  /** Most recent snapshot date (ISO `YYYY-MM-DD`). */
  date: string;
  /** Whoop recovery, 0–100. */
  recoveryScore: number | null;
  /** Heart-rate variability, ms. */
  hrv: number | null;
  /** Resting heart rate, bpm. */
  rhr: number | null;
  /** Total sleep, decimal hours (e.g. 7.2 = 7h12). */
  sleepHours: number | null;
  /** Sleep performance, 0–100. */
  sleepScore: number | null;
  /** Day strain (Whoop 0–21 scale). */
  strain: number | null;
  /** Provenance string (e.g. "whoop"). */
  source: string;
};

export type UseHealthToday = {
  data: HealthToday | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Reads the single most recent `health_snapshots` row for the signed-in user.
 * RLS scopes the query to that user, so no manual `user_id` filter is needed.
 * Returns `{ data: null }` (not an error) when the user has no snapshots yet.
 */
export function useHealthToday(): UseHealthToday {
  const [data, setData] = useState<HealthToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data: row, error: err } = await supabase
      .from("health_snapshots")
      .select("date,recovery_score,hrv,rhr,sleep_hours,sleep_score,strain,source")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setData(null);
      setLoading(false);
      setError(err.message);
      return;
    }
    setData(
      row
        ? {
            date: row.date,
            recoveryScore: row.recovery_score,
            hrv: row.hrv,
            rhr: row.rhr,
            sleepHours: row.sleep_hours,
            sleepScore: row.sleep_score,
            strain: row.strain,
            source: row.source,
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
