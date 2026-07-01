import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type JournalRow = Database["public"]["Tables"]["journal_entries"]["Row"];

export type UseJournalResult = {
  /** The most recent entry, or null when the table is empty. */
  lastEntry: JournalRow | null;
  /** Consecutive days (ending today or yesterday) that have an entry. */
  dayStreak: number;
  /** Ready-to-render meta line, e.g. "Last entry yesterday · 6-day streak". */
  meta: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Insert a new entry (written_at = now). Requires user_id (RLS insert policy). */
  addEntry: (text: string) => Promise<boolean>;
};

/** YYYY-MM-DD in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human "last entry" phrase from a written_at ISO relative to now. */
function lastEntryPhrase(iso: string): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = start(new Date());
  const then = start(new Date(iso));
  const days = Math.round((today - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Last entry today";
  if (days === 1) return "Last entry yesterday";
  return `Last entry ${days}d ago`;
}

/**
 * Day streak: walk backwards from today over the set of dates that have an
 * entry. Today not yet written still counts if yesterday has one (streak is
 * "alive"), matching how habit-style streaks read.
 */
function computeDayStreak(dates: Set<string>): number {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If today has no entry but yesterday does, start counting from yesterday.
  if (!dates.has(ymd(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(ymd(cursor))) return 0;
  }
  let streak = 0;
  while (dates.has(ymd(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildMeta(last: JournalRow | null, streak: number): string {
  if (!last) return "No entries yet";
  const phrase = lastEntryPhrase(last.written_at);
  if (streak <= 1) return phrase;
  return `${phrase} · ${streak}-day streak`;
}

const STREAK_LOOKBACK_DAYS = 60;

/**
 * Journal (read + write). Reads the latest entry for the meta line and a recent
 * window of entries to compute a day-streak. `addEntry` inserts a new row with
 * user_id (RLS insert policy checks auth.uid() = user_id) and refetches.
 */
export function useJournal(): UseJournalResult {
  const [lastEntry, setLastEntry] = useState<JournalRow | null>(null);
  const [dayStreak, setDayStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const since = new Date();
    since.setDate(since.getDate() - STREAK_LOOKBACK_DAYS);

    const { data, error: err } = await supabase
      .from("journal_entries")
      .select("*")
      .gte("written_at", since.toISOString())
      .order("written_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLastEntry(null);
      setDayStreak(0);
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    setLastEntry(rows[0] ?? null);

    const dates = new Set(rows.map((r) => ymd(new Date(r.written_at))));
    setDayStreak(computeDayStreak(dates));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const addEntry = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return false;
      }
      const { error: err } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        text: trimmed,
        written_at: new Date().toISOString(),
      });
      if (err) {
        setError(err.message);
        return false;
      }
      await refetch();
      return true;
    },
    [refetch],
  );

  const meta = buildMeta(lastEntry, dayStreak);

  return { lastEntry, dayStreak, meta, loading, error, refetch, addEntry };
}
