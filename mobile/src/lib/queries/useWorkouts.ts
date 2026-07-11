import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];

export type LatestWorkout = {
  id: string;
  sport: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  strain: number | null;
  distanceM: number | null;
  energyKj: number | null;
  source: string;
};

/** One cell of the per-day grid. `hasWorkout`/`count` are pure facts from the
 * data; `isToday` is included so a screen can style the current day without
 * re-deriving "today" itself — everything past that (state labels, colors)
 * stays a UI concern for the consuming screen. */
export type WorkoutDayCell = {
  /** YYYY-MM-DD, local. */
  date: string;
  hasWorkout: boolean;
  count: number;
  isToday: boolean;
};

export type UseWorkoutsResult = {
  latest: LatestWorkout | null;
  /** Per-day grid for the last `days` local dates, oldest first, ending today. */
  week: WorkoutDayCell[];
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

/** The last `n` local dates as YYYY-MM-DD, oldest first, ending today
 * (mirrors useHabits.ts's `lastNDates`). */
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

function mapLatest(row: WorkoutRow): LatestWorkout {
  return {
    id: row.id,
    sport: row.sport,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    strain: row.strain,
    distanceM: row.distance_m,
    energyKj: row.energy_kj,
    source: row.source,
  };
}

/** Builds the per-day grid: counts workouts (by local start date) per date
 * in `dates`, marking the last date as `isToday` (dates end today). */
function buildWeek(rows: Pick<WorkoutRow, "started_at">[], dates: string[]): WorkoutDayCell[] {
  const countByDate = new Map<string, number>();
  for (const row of rows) {
    const key = ymd(new Date(row.started_at));
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }
  const todayKey = dates[dates.length - 1];
  return dates.map((date) => {
    const count = countByDate.get(date) ?? 0;
    return { date, hasWorkout: count > 0, count, isToday: date === todayKey };
  });
}

/**
 * Workouts (read-only — Whoop/Strava sync owns writes). `latest` is the most
 * recent row; `week` is a per-day grid over the last `days` local dates
 * (default 7), ending today.
 */
export function useWorkouts(days: number = 7): UseWorkoutsResult {
  const [latest, setLatest] = useState<LatestWorkout | null>(null);
  const [week, setWeek] = useState<WorkoutDayCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const dates = lastNDates(days);
    const sinceISO = new Date(`${dates[0]}T00:00:00`).toISOString();

    const [latestRes, weekRes] = await Promise.all([
      supabase.from("workouts").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("started_at").gte("started_at", sinceISO),
    ]);

    const err = latestRes.error ?? weekRes.error ?? null;
    if (err) {
      setError(err.message);
      setLatest(null);
      setWeek([]);
      setLoading(false);
      return;
    }

    setLatest(latestRes.data ? mapLatest(latestRes.data) : null);
    setWeek(buildWeek(weekRes.data ?? [], dates));
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { latest, week, loading, error, refetch };
}
