import { useEffect, useState } from "react";

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
};

/**
 * Reads the single most recent `health_snapshots` row for the signed-in user.
 * RLS scopes the query to that user, so no manual `user_id` filter is needed.
 * Returns `{ data: null }` (not an error) when the user has no snapshots yet.
 */
export function useHealthToday(): UseHealthToday {
  const [state, setState] = useState<UseHealthToday>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    void supabase
      .from("health_snapshots")
      .select("date,recovery_score,hrv,rhr,sleep_hours,sleep_score,strain,source")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ data: null, loading: false, error: error.message });
          return;
        }
        setState({
          data: data
            ? {
                date: data.date,
                recoveryScore: data.recovery_score,
                hrv: data.hrv,
                rhr: data.rhr,
                sleepHours: data.sleep_hours,
                sleepScore: data.sleep_score,
                strain: data.strain,
                source: data.source,
              }
            : null,
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
