import { useEffect, useState } from "react";

import type { LedgerState } from "../components/spec/LedgerRow";
import { extractDueTime12h, focusData, formatEventTime12h } from "../data/focus";
import { useCalendarToday, useHabits, useJournal, useTasks } from "../lib/queries";

export type QueueRowVM = {
  key: string;
  time: string;
  title: string;
  tag: "CAL" | "TASK" | "HABIT" | "JOURNAL";
  state: LedgerState;
  onPress?: () => void;
};

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

/**
 * Focus's QUEUE ledger (spec §7c) — merges today's calendar (read), tasks
 * (read + toggle), habits (read + toggle today), and the journal (read +
 * write, opened from its own queue row) into one ledger-row view model.
 * Extracted out of FocusScreen.tsx so the screen component stays render-only;
 * also owns the once-a-second clock tick the screen's live timer/band clock
 * read off of.
 */
export function useQueueRows(): UseQueueRowsResult {
  const calendar = useCalendarToday();
  const tasks = useTasks();
  const habits = useHabits();
  const journal = useJournal();
  const [journalOpen, setJournalOpen] = useState(false);
  const nowMs = useNowMs();

  const calendarRows: QueueRowVM[] = calendar.data.map((ev) => ({
    key: `cal-${ev.id}`,
    time: formatEventTime12h(ev.time),
    title: ev.title,
    tag: "CAL",
    state: ev.state === "done" ? "done" : "up",
  }));

  const taskRows: QueueRowVM[] = tasks.today.map((item) => ({
    key: `task-${item.id}`,
    time: extractDueTime12h(item.sub) ?? "—",
    title: item.title,
    tag: "TASK",
    state: item.done ? "done" : "up",
    onPress: () => void tasks.toggleTask(item.id, !item.done),
  }));

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

  const queueRows = [...calendarRows, ...taskRows, ...habitRows, journalRow];
  const queueLoading = calendar.loading || tasks.loading || habits.loading || journal.loading;
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
