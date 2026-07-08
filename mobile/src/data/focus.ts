/**
 * Focus (spec §7c) — content data + small time-formatting helpers. Deep-work
 * session tracking (the live timer, sessions/deep-hrs/streak stats, the week
 * strip) has no backing provider yet, so it's mock — see the `mock` comments
 * below. The QUEUE ledger itself is live (calendar/tasks/habits/journal,
 * wired in FocusScreen.tsx); the helpers here just reformat what those hooks
 * already return into the spec's 12-hour time style.
 *
 * `Habit` / `HabitDot` stay exported from this file because useHabits.ts
 * builds its `FocusHabitItem` as `Habit & { id; todayDone }` — don't change
 * their shape without updating that hook.
 */

/** 7-day dot state for a habit (consumed by useHabits.ts's FocusHabitItem). */
export type HabitDot = "done" | "empty" | "today";

export type Habit = {
  name: string;
  /** Streak read-out, e.g. "12-day streak" or "Streak reset · 0". */
  streak: string;
  /** A reset streak reads in muted ink (never red). */
  reset?: boolean;
  dots: HabitDot[];
};

export type WeekCell = {
  /** Single-letter weekday (M T W T F S S). */
  letter: string;
  /** Day-of-month number. */
  date: string;
  /** Deep-work hours logged that day ("2:05") — omit to render "—". */
  hours?: string;
  today?: boolean;
};

export const focusData = {
  title: "Focus",
  status: [
    "Two blocks left — ",
    { b: "protect the afternoon." },
  ],

  // mock — no provider yet: deep-work session tracking isn't in the schema.
  // The 44:12 timer in FocusScreen ticks live off `elapsedAtLoadSec`.
  session: {
    label: "Deep work — pricing model",
    elapsedAtLoadSec: 44 * 60 + 12,
    /** Fixed block end, 24h "HH:MM" local. */
    endsAt: "15:00",
    /** Total planned block length in minutes — drives the ~42% fill. */
    blockMinutes: 105,
  },

  // mock — no provider yet
  stats: {
    sessions: { done: 3, total: 4, left: 1 },
    deepHours: "3:12",
    deepGoal: "4:00",
    streakDays: 12,
  },

  // mock — no provider yet
  week: {
    rangeLabel: "MAY 4–10",
    avgLabel: "AVG 2:54",
    days: [
      { letter: "M", date: "4", hours: "2:05" },
      { letter: "T", date: "5", hours: "2:50" },
      { letter: "W", date: "6", hours: "1:20" },
      { letter: "T", date: "7", hours: "3:05" },
      { letter: "F", date: "8", hours: "3:12", today: true },
      { letter: "S", date: "9" },
      { letter: "S", date: "10" },
    ] satisfies WeekCell[],
  },

  journal: {
    prompt: "What pulled your focus today?",
    placeholder: "Tap to write",
  },
};

/**
 * "FRIDAY · MAY 8" — today's weekday + date, live (design README eyebrow
 * row). Duplicated from data/body.ts's identical helper — each screen's data
 * module is self-contained by convention, so this stays a tiny local copy
 * rather than a cross-screen import.
 */
export function eyebrowDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${weekday} · ${month} ${d.getDate()}`;
}

/** "H:MM AM/PM" for a Date — the live clock in the LIVE band. */
export function formatClock12h(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/** "HH:MM" 24h → "H:MM AM/PM" (design README: all times render 12-hour). */
export function formatHHMM12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  return formatClock12h(new Date(2000, 0, 1, Number(hStr), Number(mStr)));
}

/** Elapsed seconds → a count-up "mm:ss" label (e.g. "44:12"). */
export function formatElapsed(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** useCalendarToday's "HH:MM" (or the literal "NOW") → 12-hour, "NOW" passes through. */
export function formatEventTime12h(time: string): string {
  if (time === "NOW") return time;
  return formatHHMM12h(time);
}

/**
 * Pull a 12-hour clock time out of useTasks' pre-formatted `sub` string
 * ("TAG · DUE 14:00"), or null when the task has no due time. Coupled to
 * useTasks.ts's `buildSub` output on purpose — that hook is preserved as-is,
 * so this reads what it already renders rather than re-deriving `due_at`.
 */
export function extractDueTime12h(sub: string): string | null {
  const match = /DUE (\d{2}):(\d{2})/.exec(sub);
  if (!match) return null;
  return formatHHMM12h(`${match[1]}:${match[2]}`);
}
