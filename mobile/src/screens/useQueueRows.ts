import { useEffect, useState } from "react";

import type { LedgerState } from "../components/spec/LedgerRow";
import { extractDueTime12h, focusData, formatEventTime12h } from "../data/focus";
import type { CalendarTodayEvent } from "../lib/queries";
import { useCalendarToday, useHabits, useJournal, useTasks } from "../lib/queries";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { useNav } from "../navigation/NavContext";

type CalendarEventRawRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type TaskRawRow = Database["public"]["Tables"]["tasks"]["Row"];

export type QueueRowVM = {
  key: string;
  time: string;
  title: string;
  tag: "CAL" | "TASK" | "HABIT" | "JOURNAL";
  state: LedgerState;
  onPress?: () => void;
};

/** "queue" (default) = Focus's QUEUE ledger, unchanged: calendar + tasks +
 * habits + journal, tasks tap-to-toggle. "today-all" = Home's TODAY ledger:
 * the full day's calendar (done/now/up) + tasks due today (done + open),
 * sorted chronologically, no habits/journal, tasks tap-to-openDetail (same
 * as events) instead of toggling in place. */
export type QueueRowsMode = "queue" | "today-all";

export type UseQueueRowsResult = {
  /** Ticks once a second — drives FocusScreen's live "44:12" timer + band clock. */
  nowMs: number;
  queueRows: QueueRowVM[];
  queueLoading: boolean;
  queueLeft: number;
  /** Whether the inline JournalField is expanded (toggled by the journal row). */
  journalOpen: boolean;
  /** Insert a new journal entry — passed through to JournalField's onSubmit. */
  addJournalEntry: (text: string) => Promise<boolean>;
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ticks once a second — drives the live "44:12" timer and the band's clock. */
function useNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return nowMs;
}

/** Local start/end of today as ISO strings. */
function todayBoundsISO(): { startISO: string; endISO: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * Raw `calendar_events`/`tasks` rows for today, keyed by id — fetched purely
 * to enrich `openDetail`'s payload with the underlying DB column names
 * DetailScreen reads defensively (task B8: `starts_at`/`ends_at`/`location`/
 * `source`/`external_id` for events; `id`/`due_at`/`priority`/`tags`/`done`
 * for tasks). `useCalendarToday`/`useTasks` only expose display-shaped
 * fields, not the raw row, so this is a second lightweight read-only fetch
 * alongside them — never rendered inline, only spread onto a DetailItem.
 */
function useDetailRawRows(): {
  eventsById: Map<string, CalendarEventRawRow>;
  tasksById: Map<string, TaskRawRow>;
} {
  const [eventsById, setEventsById] = useState<Map<string, CalendarEventRawRow>>(new Map());
  const [tasksById, setTasksById] = useState<Map<string, TaskRawRow>>(new Map());

  useEffect(() => {
    let active = true;
    const { startISO, endISO } = todayBoundsISO();
    void Promise.all([
      supabase.from("calendar_events").select("*").gte("starts_at", startISO).lt("starts_at", endISO),
      supabase.from("tasks").select("*"),
    ]).then(([eventsRes, tasksRes]) => {
      if (!active) return;
      if (eventsRes.data) setEventsById(new Map(eventsRes.data.map((r) => [r.id, r])));
      if (tasksRes.data) setTasksById(new Map(tasksRes.data.map((r) => [r.id, r])));
    });
    return () => {
      active = false;
    };
  }, []);

  return { eventsById, tasksById };
}

/** Chronological sort key (ms) for a calendar row — prefers the raw row's
 * `starts_at` (exact), falls back to parsing the display `HH:MM`/`NOW` when
 * the raw fetch hasn't resolved yet. */
function eventSortMs(ev: CalendarTodayEvent, raw: CalendarEventRawRow | undefined, nowMs: number): number {
  if (raw?.starts_at) return new Date(raw.starts_at).getTime();
  if (ev.time === "NOW") return nowMs;
  const match = /^(\d{2}):(\d{2})$/.exec(ev.time);
  if (!match) return Number.POSITIVE_INFINITY;
  const now = new Date(nowMs);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2])).getTime();
}

type ScoredRow = { row: QueueRowVM; sortMs: number };

/**
 * The QUEUE ledger (Focus, spec §7c) / TODAY ledger (Home, task B5) shared
 * row builder — merges today's calendar (read), tasks (read + toggle in
 * "queue" mode), habits (read + toggle, "queue" mode only), and the journal
 * (read + write, "queue" mode only, opened from its own queue row) into one
 * ledger-row view model. Extracted out of the screens so they stay
 * render-only; also owns the once-a-second clock tick both screens' live
 * timer/band clock read off of.
 */
export function useQueueRows(mode: QueueRowsMode = "queue"): UseQueueRowsResult {
  const calendar = useCalendarToday();
  const tasks = useTasks();
  const habits = useHabits();
  const journal = useJournal();
  const { eventsById, tasksById } = useDetailRawRows();
  const { openDetail } = useNav();
  const [journalOpen, setJournalOpen] = useState(false);
  const nowMs = useNowMs();

  const calendarScored: ScoredRow[] = calendar.data.map((ev) => {
    const raw = eventsById.get(ev.id);
    return {
      sortMs: eventSortMs(ev, raw, nowMs),
      row: {
        key: `cal-${ev.id}`,
        time: formatEventTime12h(ev.time),
        title: ev.title,
        tag: "CAL",
        state: ev.state === "done" ? "done" : "up",
        // Raw fields spread first, then the live display fields override —
        // `ev.*` reflects this render's freshly-computed state (e.g. "now"
        // rolling over as the clock ticks), the raw snapshot doesn't.
        onPress: () =>
          openDetail({ kind: "event", ...raw, title: ev.title, time: ev.time, sub: ev.sub, state: ev.state }),
      },
    };
  });

  const taskScored: ScoredRow[] = tasks.today.map((item) => {
    const raw = tasksById.get(item.id);
    return {
      sortMs: raw?.due_at ? new Date(raw.due_at).getTime() : Number.POSITIVE_INFINITY,
      row: {
        key: `task-${item.id}`,
        time: extractDueTime12h(item.sub) ?? "—",
        title: item.title,
        tag: "TASK",
        state: item.done ? "done" : "up",
        // Raw fields spread first, then the live display fields override —
        // `item.done` reflects useTasks' optimistic toggle, the raw snapshot
        // (fetched separately, purely for Detail's id/due_at/priority/tags) doesn't.
        onPress:
          mode === "today-all"
            ? () => openDetail({ kind: "task", ...raw, title: item.title, sub: item.sub, done: item.done })
            : () => void tasks.toggleTask(item.id, !item.done),
      },
    };
  });

  const habitRows: QueueRowVM[] = habits.data.map((h) => ({
    key: `habit-${h.id}`,
    time: "—",
    title: h.name,
    tag: "HABIT",
    state: h.todayDone ? "done" : "up",
    onPress: () => void habits.toggleHabitToday(h.id, !h.todayDone),
  }));

  const journalDoneToday =
    journal.lastEntry != null && isSameLocalDay(new Date(journal.lastEntry.written_at), new Date());
  const journalRow: QueueRowVM = {
    key: "journal",
    time: "—",
    title: focusData.journal.prompt,
    tag: "JOURNAL",
    state: journalDoneToday ? "done" : "up",
    onPress: () => setJournalOpen((v) => !v),
  };

  const queueRows: QueueRowVM[] =
    mode === "today-all"
      ? [...calendarScored, ...taskScored].sort((a, b) => a.sortMs - b.sortMs).map((s) => s.row)
      : [...calendarScored.map((s) => s.row), ...taskScored.map((s) => s.row), ...habitRows, journalRow];

  const queueLoading =
    mode === "today-all" ? calendar.loading || tasks.loading : calendar.loading || tasks.loading || habits.loading || journal.loading;
  const queueLeft = queueRows.filter((r) => r.state === "up").length;

  return {
    nowMs,
    queueRows,
    queueLoading,
    queueLeft,
    journalOpen,
    addJournalEntry: journal.addEntry,
  };
}
