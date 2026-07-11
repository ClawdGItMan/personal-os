import { useCallback, useEffect, useState } from "react";

import { fireSuccessHaptic } from "../../components/spec/Pressed";
import { supabase } from "../supabase";
import type { Database } from "../database.types";

type TaskRowModel = Database["public"]["Tables"]["tasks"]["Row"];

/** A task mapped to what the shared TaskRow consumes, plus id + bucket for logic. */
export type FocusTaskItem = {
  id: string;
  title: string;
  sub: string;
  done: boolean;
  /** priority === "high" → yellow flag on the row. */
  priority: boolean;
  /** Has a due time → render the sub in blue. */
  timeBlocked: boolean;
  /** Which group this task belongs to. */
  bucket: "today" | "week" | "later";
};

export type UseTasksResult = {
  /** Due today OR undated. */
  today: FocusTaskItem[];
  /** Due within the next 7 days (excluding today). */
  week: FocusTaskItem[];
  /** done / total for the Today group, 0–1. */
  todayDonePct: number;
  todayDoneCount: number;
  todayTotal: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Optimistically flip a task's `done`, persist, and revert on failure. */
  toggleTask: (id: string, next: boolean) => Promise<void>;
  /** Push a task's `due_at` to `untilIso` (e.g. "Snooze +1 day"). Optimistically
   * moves the item to the bucket implied by the new due date, reverting on
   * failure, then refetches so the rest (sub's due-time text, ordering)
   * resyncs from the server. */
  snoozeTask: (id: string, untilIso: string) => Promise<void>;
};

function startOfTodayMs(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "HH:MM" local time — used to hint the due time in a task's sub. */
function formatDueTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Build the mono uppercase sublabel from the task's first tag + due time. */
function buildSub(row: TaskRowModel): string {
  const parts: string[] = [];
  const tag = row.tags?.[0];
  if (tag) parts.push(tag);
  if (row.due_at) parts.push(`DUE ${formatDueTime(row.due_at)}`);
  return parts.join(" · ");
}

/** Today: due_at today OR null. Week: due within next 7 days. Else: later. */
function bucketOf(dueISO: string | null): FocusTaskItem["bucket"] {
  if (dueISO == null) return "today";
  const start = startOfTodayMs();
  const todayEnd = start + DAY_MS;
  const weekEnd = start + 7 * DAY_MS;
  const due = new Date(dueISO).getTime();
  if (due < todayEnd) return "today"; // today or overdue → surface in Today
  if (due < weekEnd) return "week";
  return "later";
}

function mapTask(row: TaskRowModel): FocusTaskItem {
  return {
    id: row.id,
    title: row.title,
    sub: buildSub(row),
    done: row.done,
    priority: row.priority === "high",
    timeBlocked: row.due_at != null,
    bucket: bucketOf(row.due_at),
  };
}

/**
 * Tasks (read + write). Ordered star desc, created_at asc; grouped Today vs this
 * week. `toggleTask` writes `done` optimistically and reverts on error. RLS
 * scopes reads; the update targets a single id (also RLS-scoped).
 */
export function useTasks(): UseTasksResult {
  const [rows, setRows] = useState<FocusTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("tasks")
      .select("*")
      .order("star", { ascending: false })
      .order("created_at", { ascending: true });

    if (err) {
      setError(err.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []).map(mapTask));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const toggleTask = useCallback(async (id: string, next: boolean) => {
    // Optimistic: flip locally first.
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    const { error: err } = await supabase.from("tasks").update({ done: next }).eq("id", id);
    if (err) {
      // Revert on failure.
      setRows((prev) => prev.map((t) => (t.id === id ? { ...t, done: !next } : t)));
      setError(err.message);
      return;
    }
    // Directional: only buzz when marking done, not when reopening/un-completing.
    if (next) fireSuccessHaptic();
  }, []);

  const snoozeTask = useCallback(
    async (id: string, untilIso: string) => {
      // Optimistic: move the item to the bucket implied by the new due date
      // (drives it out of "today" immediately); refetch resyncs the rest
      // (sub's due-time text, ordering) once the write lands.
      const prevRows = rows;
      setRows((prev) => prev.map((t) => (t.id === id ? { ...t, bucket: bucketOf(untilIso) } : t)));
      const { error: err } = await supabase.from("tasks").update({ due_at: untilIso }).eq("id", id);
      if (err) {
        setRows(prevRows);
        setError(err.message);
        return;
      }
      // DetailScreen's Snooze action no longer fires its own haptic (C1
      // fix pass: hooks own success haptics) — this is now its one buzz.
      fireSuccessHaptic();
      await refetch();
    },
    [rows, refetch],
  );

  const today = rows.filter((t) => t.bucket === "today");
  const week = rows.filter((t) => t.bucket === "week");

  const todayTotal = today.length;
  const todayDoneCount = today.filter((t) => t.done).length;
  const todayDonePct = todayTotal === 0 ? 0 : todayDoneCount / todayTotal;

  return {
    today,
    week,
    todayDonePct,
    todayDoneCount,
    todayTotal,
    loading,
    error,
    refetch,
    toggleTask,
    snoozeTask,
  };
}
