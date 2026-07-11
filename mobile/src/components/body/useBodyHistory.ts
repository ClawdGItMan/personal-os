import { useMemo } from "react";

import type { HealthHistoryPoint } from "../../lib/queries";

/**
 * Small history derivation colocated here (not in `lib/queries/`) — Task
 * B3's file scope excluded editing the query hooks. Task C4 promoted the raw
 * fetch this used to own into `lib/queries/useHealthHistory.ts` (a `days`-
 * parameterized hook several Body surfaces now share: this derivation, the
 * HRV band's RangeToggle, and the WEIGHT stat's trend expand), so this file
 * is now a pure derivation over the points that hook returns — no fetch,
 * no loading/error/refetch of its own. Callers read those from the shared
 * `useHealthHistory` result instead (see BodyScreen).
 */
export type UseBodyHistoryResult = {
  weightLatest: number | null;
  /** Latest weight minus the closest snapshot ≥30 days before it (same raw
   * unit as stored — see note below). `null` when no snapshot exists that
   * far back in `points` (not enough history yet), not when the value is
   * genuinely zero. */
  weightDeltaLb: number | null;
  /** Σ max(0, 7.5h − sleepHours) over the last 7 local days, in minutes. Days
   * with no `sleep_hours` value are skipped entirely (treated as unknown, not
   * as zero sleep) so a sync gap doesn't inflate the debt. */
  sleepDebtMin: number;
};

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
function computeWeightDelta(points: readonly HealthHistoryPoint[]): {
  latest: number | null;
  deltaLb: number | null;
} {
  const withWeight = points.filter((p): p is HealthHistoryPoint & { weight: number } => p.weight != null);
  if (withWeight.length === 0) return { latest: null, deltaLb: null };

  const latestPoint = withWeight[withWeight.length - 1];
  const targetTime = new Date(`${latestPoint.date}T00:00:00`).getTime() - 30 * 86400000;

  let prior: (HealthHistoryPoint & { weight: number }) | null = null;
  for (const p of withWeight) {
    const t = new Date(`${p.date}T00:00:00`).getTime();
    if (t <= targetTime) prior = p; // ascending order → keep the closest-before-or-on target
    else break;
  }

  if (!prior) return { latest: latestPoint.weight, deltaLb: null };
  return { latest: latestPoint.weight, deltaLb: Math.round((latestPoint.weight - prior.weight) * 10) / 10 };
}

function computeSleepDebtMin(points: readonly HealthHistoryPoint[]): number {
  const byDate = new Map(points.map((p) => [p.date, p.sleepHours]));
  let debtHours = 0;
  for (const date of lastNDates(7)) {
    const hours = byDate.get(date);
    if (hours == null) continue; // no data that day — skip, don't assume 0 slept
    debtHours += Math.max(0, TARGET_DEBT_HOURS - hours);
  }
  return Math.round(debtHours * 60);
}

/** Derives the WEIGHT stat's 30d delta and the SLEEP DEBT line from a
 * `useHealthHistory(days)` points array (needs ≥30d + a 7d margin — see
 * BodyScreen's `useHealthHistory(90)` call). */
export function useBodyHistory(points: readonly HealthHistoryPoint[]): UseBodyHistoryResult {
  return useMemo(() => {
    const { latest, deltaLb } = computeWeightDelta(points);
    return { weightLatest: latest, weightDeltaLb: deltaLb, sleepDebtMin: computeSleepDebtMin(points) };
  }, [points]);
}
