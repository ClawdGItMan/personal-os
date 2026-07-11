import { time12 } from "../lib/format";
import type { FocusWeekMinutePoint } from "../lib/queries";

/**
 * Focus (spec §7c) — content data + small time-formatting helpers, plus the
 * pure calculations that back the LIVE band's timer/progress/overtime state
 * and the THIS WEEK strip's calendar mapping. Deep-work session tracking
 * (live timer, sessions/deep-hrs/streak stats, week strip) is now LIVE via
 * `useFocusSessions` (wired in FocusScreen.tsx / LiveTimerBand.tsx) — the
 * helpers below are colocated pure functions, not mock content, so they stay
 * independently testable/reusable (e.g. by a future Home FOCUS band) without
 * pulling in React or the screen.
 *
 * The QUEUE ledger stays live (calendar/tasks/habits/journal, wired in
 * FocusScreen.tsx / useQueueRows.ts); the helpers here just reformat what
 * those hooks already return into the spec's 12-hour time style, reusing
 * `lib/format.ts::time12` for the actual 12-hour conversion.
 *
 * `Habit` / `HabitDot` stay exported from this file because useHabits.ts
 * builds its `FocusHabitItem` as `Habit & { id; todayDone }` — don't change
 * their shape without updating that hook. `focusData.journal` stays exported
 * because useQueueRows.ts reads `focusData.journal.prompt` directly — don't
 * rename/remove it without updating that hook too.
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

  journal: {
    prompt: "What pulled your focus today?",
    placeholder: "Tap to write",
  },
};

/** "HH:MM" 24h → "H:MM AM/PM" (design README: all times render 12-hour). */
export function formatHHMM12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  return time12(new Date(2000, 0, 1, Number(hStr), Number(mStr)));
}

/** Elapsed seconds → a count-up "mm:ss" label (e.g. "44:12"); `mm` is raw
 * minutes (not modulo 60), so a >59min session reads "105:12", not "1:45:12". */
export function formatElapsed(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Total minutes → "H:MM" (e.g. 192 → "3:12"); hours unpadded, matches the
 * spec's stat/week-cell hour format. */
export function formatMinutesHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
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

// --- LIVE band math (pure, colocated — see useFocusSessions.ts for the fetch
// side). Kept independent of React/nowMs plumbing so a future consumer (e.g.
// Home's mock FOCUS band) can reuse the same calc without adopting Focus's
// screen wiring. ---

/** Elapsed seconds since `startedAt`, against a ticking `nowMs` (never negative). */
export function focusElapsedSec(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
}

/** Block progress 0–1, capped at 1 (spec: overtime keeps the bar full, never overflows). */
export function focusPct(elapsedSec: number, plannedMinutes: number): number {
  if (plannedMinutes <= 0) return 1;
  return Math.min(1, elapsedSec / (plannedMinutes * 60));
}

/** True once elapsed time exceeds the planned block (spec: timer value renders amber). */
export function focusIsOvertime(elapsedSec: number, plannedMinutes: number): boolean {
  return elapsedSec > plannedMinutes * 60;
}

/** Planned block end, ms epoch — `startedAt` + `plannedMinutes`. */
export function focusEndsAtMs(startedAt: string, plannedMinutes: number): number {
  return new Date(startedAt).getTime() + plannedMinutes * 60000;
}

// --- THIS WEEK strip mapping (pure) ---

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const; // Mon..Sun

/** YYYY-MM-DD in local time — matches useFocusSessions.ts's internal `ymd`. */
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Maps `useFocusSessions`'s rolling 7-day `weekMinutes` (oldest-first, ending
 * today) onto the fixed Mon→Sun cells of the *current calendar week*,
 * device-local. A calendar week's Monday is at most 6 days before today, so
 * it always falls inside the rolling window — every day up to and including
 * today gets a real "H:MM" (possibly "0:00"); days after today (not yet
 * happened) are left without `hours` so WeekStrip renders its dim "—".
 */
export function buildWeekCells(weekMinutes: FocusWeekMinutePoint[], now: Date): WeekCell[] {
  const minutesByDate = new Map(weekMinutes.map((p) => [p.date, p.minutes]));
  const todayKey = ymdLocal(now);
  const dowMondayFirst = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowMondayFirst);

  return WEEKDAY_LETTERS.map((letter, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = ymdLocal(d);
    const isFuture = key > todayKey;
    const minutes = minutesByDate.get(key);
    return {
      letter,
      date: String(d.getDate()),
      hours: !isFuture && minutes != null ? formatMinutesHM(minutes) : undefined,
      today: key === todayKey,
    };
  });
}

const MONTHS_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** "This week" band header range, e.g. "JUL 6–12" (or "JUN 29–JUL 5" across a month boundary). */
export function weekRangeLabel(now: Date): string {
  const dowMondayFirst = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowMondayFirst);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const mLabel = MONTHS_SHORT[monday.getMonth()];
  const sLabel = MONTHS_SHORT[sunday.getMonth()];
  return mLabel === sLabel
    ? `${mLabel} ${monday.getDate()}–${sunday.getDate()}`
    : `${mLabel} ${monday.getDate()}–${sLabel} ${sunday.getDate()}`;
}

/** "This week" band header average, e.g. "AVG 1:45" — averaged over the
 * week's already-happened days only (future dim "—" days don't count). */
export function weekAvgLabel(cells: WeekCell[]): string {
  const withHours = cells.filter((cell): cell is WeekCell & { hours: string } => cell.hours != null);
  if (withHours.length === 0) return "AVG 0:00";
  const totalMinutes = withHours.reduce((sum, cell) => {
    const [h, m] = cell.hours.split(":").map(Number);
    return sum + h * 60 + m;
  }, 0);
  return `AVG ${formatMinutesHM(Math.round(totalMinutes / withHours.length))}`;
}
