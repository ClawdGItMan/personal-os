import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";

/**
 * One `health_snapshots` row, reshaped for history/trend consumers. Every
 * metric is nullable because a given day's Whoop sync may only cover some
 * fields — callers decide how to treat a gap (skip vs. zero).
 */
export type HealthHistoryPoint = {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Heart-rate variability, ms. */
  hrv: number | null;
  weight: number | null;
  /** Total sleep, decimal hours. */
  sleepHours: number | null;
};

export type UseHealthHistoryResult = {
  /** Ascending by date. */
  points: HealthHistoryPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/** YYYY-MM-DD in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Points must be sorted ascending by date. Returns only the points whose
 * date falls within the last `days` local days (inclusive of today). Used
 * by the range-toggled charts (HRV band, weight trend expand) to slice a
 * single wider fetch down to the selected 7D/30D/90D window — mirrors
 * `useMoney.ts`'s `lastNDaysOfSeries`. */
export function sliceLastNDays<T extends { date: string }>(points: readonly T[], days: number): T[] {
  const cutoff = ymd(new Date(Date.now() - (days - 1) * 86400000));
  return points.filter((p) => p.date >= cutoff);
}

/**
 * `health_snapshots` history for the last `days` local days (ascending by
 * date). Promoted out of `components/body/useBodyHistory.ts` (task C4) so
 * both the Body screen's range-toggled charts (HRV band, weight trend
 * expand — each slices this with `sliceLastNDays`) and `useBodyHistory`'s
 * existing 30d-weight-delta/7d-sleep-debt derivation share one fetch instead
 * of duplicating the query. RLS scopes the read to the signed-in user, no
 * manual `user_id` filter needed (matches `useHealthToday`'s read pattern).
 */
export function useHealthHistory(days: number): UseHealthHistoryResult {
  const [points, setPoints] = useState<HealthHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const sinceISO = ymd(new Date(Date.now() - days * 86400000));

    const { data, error: err } = await supabase
      .from("health_snapshots")
      .select("date,hrv,weight,sleep_hours")
      .gte("date", sinceISO)
      .order("date", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setPoints(
      (data ?? []).map((r) => ({ date: r.date, hrv: r.hrv, weight: r.weight, sleepHours: r.sleep_hours })),
    );
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { points, loading, error, refetch };
}
