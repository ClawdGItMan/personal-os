import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

/**
 * Small history read colocated here (not in `lib/queries/`) — Task B3's file
 * scope excludes editing the query hooks, and `useHealthToday`/
 * `useSleepDetail` only expose the single latest `health_snapshots` row.
 * The WEIGHT stat's 30-day delta and the SLEEP DEBT line both need a short
 * window of history, so this hook fetches one small range and derives both,
 * following `useHealthToday.ts`'s plain read pattern (RLS-scoped, no manual
 * `user_id` filter).
 */
export type UseBodyHistoryResult = {
  weightLatest: number | null;
  /** Latest weight minus the closest snapshot ≥30 days before it (same raw
   * unit as stored — see note below). `null` when no snapshot exists that
   * far back in the fetched window (not enough history yet), not when the
   * value is genuinely zero. */
  weightDeltaLb: number | null;
  /** Σ max(0, 7.5h − sleepHours) over the last 7 local days, in minutes. Days
   * with no `sleep_hours` value are skipped entirely (treated as unknown, not
   * as zero sleep) so a sync gap doesn't inflate the debt. */
  sleepDebtMin: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

type HistoryPoint = { date: string; weight: number | null; sleepHours: number | null };

/** 30d weight lookback + 7d sleep-debt window, plus margin for sync gaps. */
const HISTORY_DAYS = 40;
const TARGET_DEBT_HOURS = 7.5;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The last `n` local dates as YYYY-MM-DD, oldest first, ending today
 * (mirrors `useWorkouts.ts`'s `lastNDates`). */
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

/** Points must be sorted ascending by date. Finds the latest weight and the
 * closest earlier weight at or before (latest date − 30d). */
function computeWeightDelta(points: readonly HistoryPoint[]): { latest: number | null; deltaLb: number | null } {
  const withWeight = points.filter((p): p is HistoryPoint & { weight: number } => p.weight != null);
  if (withWeight.length === 0) return { latest: null, deltaLb: null };

  const latestPoint = withWeight[withWeight.length - 1];
  const targetTime = new Date(`${latestPoint.date}T00:00:00`).getTime() - 30 * 86400000;

  let prior: (HistoryPoint & { weight: number }) | null = null;
  for (const p of withWeight) {
    const t = new Date(`${p.date}T00:00:00`).getTime();
    if (t <= targetTime) prior = p; // ascending order → keep the closest-before-or-on target
    else break;
  }

  if (!prior) return { latest: latestPoint.weight, deltaLb: null };
  return { latest: latestPoint.weight, deltaLb: Math.round((latestPoint.weight - prior.weight) * 10) / 10 };
}

function computeSleepDebtMin(points: readonly HistoryPoint[]): number {
  const byDate = new Map(points.map((p) => [p.date, p.sleepHours]));
  let debtHours = 0;
  for (const date of lastNDates(7)) {
    const hours = byDate.get(date);
    if (hours == null) continue; // no data that day — skip, don't assume 0 slept
    debtHours += Math.max(0, TARGET_DEBT_HOURS - hours);
  }
  return Math.round(debtHours * 60);
}

export function useBodyHistory(): UseBodyHistoryResult {
  const [weightLatest, setWeightLatest] = useState<number | null>(null);
  const [weightDeltaLb, setWeightDeltaLb] = useState<number | null>(null);
  const [sleepDebtMin, setSleepDebtMin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const sinceISO = ymd(new Date(Date.now() - HISTORY_DAYS * 86400000));

    const { data, error: err } = await supabase
      .from("health_snapshots")
      .select("date,weight,sleep_hours")
      .gte("date", sinceISO)
      .order("date", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const points: HistoryPoint[] = (data ?? []).map((r) => ({
      date: r.date,
      weight: r.weight,
      sleepHours: r.sleep_hours,
    }));
    const { latest, deltaLb } = computeWeightDelta(points);
    setWeightLatest(latest);
    setWeightDeltaLb(deltaLb);
    setSleepDebtMin(computeSleepDebtMin(points));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { weightLatest, weightDeltaLb, sleepDebtMin, loading, error, refetch };
}
