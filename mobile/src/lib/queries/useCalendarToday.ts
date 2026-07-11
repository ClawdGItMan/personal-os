import { useCallback, useEffect, useState } from "react";

import type { EventState } from "../../components/EventRow";
import { supabase } from "../supabase";
import type { Database } from "../database.types";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];

/** A calendar event mapped to the shape the shared EventRow consumes. */
export type CalendarTodayEvent = {
  id: string;
  /** Left-aligned time label ("09:30", or "NOW" for the in-progress block). */
  time: string;
  state: EventState;
  title: string;
  /** Mono uppercase sublabel — from `sub`, falling back to `location`. */
  sub: string;
};

export type UseCalendarTodayResult = {
  data: CalendarTodayEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/** Local start / end of today as ISO strings for a `starts_at` BETWEEN filter. */
function todayBounds(): { startISO: string; endISO: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** "HH:MM" in the device's local time. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** done: ended in the past · now: currently within [start,end] · up: still upcoming. */
function deriveState(row: CalendarEventRow, now: number): EventState {
  const start = new Date(row.starts_at).getTime();
  const end = row.ends_at ? new Date(row.ends_at).getTime() : null;
  if (end !== null && end < now) return "done";
  if (start <= now && (end === null ? start === now : now < end)) return "now";
  if (end === null && start < now) return "done";
  return "up";
}

function mapEvent(row: CalendarEventRow, now: number): CalendarTodayEvent {
  const state = deriveState(row, now);
  return {
    id: row.id,
    time: state === "now" ? "NOW" : formatTime(row.starts_at),
    state,
    title: row.title,
    sub: row.sub || row.location || "",
  };
}

/**
 * Today's calendar events (read-only). RLS scopes rows to the signed-in user, so
 * no manual user_id filter — we just bound `starts_at` to today and order by it.
 */
export function useCalendarToday(): UseCalendarTodayResult {
  const [data, setData] = useState<CalendarTodayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { startISO, endISO } = todayBounds();
    const { data: rows, error: err } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO)
      .order("starts_at", { ascending: true });

    if (err) {
      setError(err.message);
      setData([]);
      setLoading(false);
      return;
    }
    const now = Date.now();
    setData((rows ?? []).map((row) => mapEvent(row, now)));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await refetch();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
