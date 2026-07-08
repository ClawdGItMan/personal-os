import type { StatusSegment } from "../components/spec/TitleBlock";

/**
 * Home mock data (design README §Home) + the live-merge contract. HomeScreen
 * reads `homeData.*` at render time; `applyLiveHome` writes Whoop
 * recovery/sleep/HRV/rest-HR and the real habit tally over the mock in place
 * (idempotent, null-safe — a field only updates once its live value has
 * resolved). Net worth and the TODAY ledger stay mock — Plaid and the
 * calendar/task providers aren't wired into Home (design README §State
 * Management; constraints.md).
 */

export type TimelineState = "done" | "up";

export type TimelineItem = {
  /** 12-hour time, e.g. "9:30 AM". */
  time: string;
  state: TimelineState;
  title: string;
  /** Ledger tag, e.g. OPS/CAL/BODY/FOCUS/HABIT. */
  tag: string;
};

/** Live focus session shape — mock only, no session provider yet (design README §Home). */
export type FocusSession = {
  time: string;
  title: string;
  sub: string;
  /** Session progress 0–100. */
  fillPct: number;
};

export const homeData = {
  /** Status line under the greeting — bold spans render at full ink (TitleBlock). */
  status: [
    "Recovery's ",
    { b: "green" },
    " and your afternoon is clear until the ",
    { b: "Sequoia call" },
    ".",
  ] satisfies StatusSegment[],
  // mock — no session provider yet
  focusSession: {
    time: "1:16 PM",
    title: "Deep work — pricing model",
    sub: "44 MIN IN · ENDS 3:00 PM",
    fillPct: 42,
  } satisfies FocusSession,
  recovery: { score: 72 },
  hrv: { ms: 64, restHr: 48 },
  vitals: {
    sleep: { hours: "7", minutes: "12", sub: "87% QUAL" },
    // mock — no provider yet (Plaid is Max-owned)
    netWorth: { value: "$2.83M", sub: "+0.03% · 30D" },
    habits: { done: 4, total: 6 },
  },
  today: { meta: "8 EVENTS · 3 DONE" },
  // mock — no calendar/task provider wired into Home yet
  timeline: [
    { time: "9:30 AM", state: "done", title: "Standup", tag: "OPS" },
    { time: "10:00 AM", state: "done", title: "1:1 · Sarah K", tag: "CAL" },
    { time: "11:00 AM", state: "done", title: "Train · push day", tag: "BODY" },
    { time: "5:00 PM", state: "up", title: "Review compliance checklist", tag: "FOCUS" },
    { time: "7:00 PM", state: "up", title: "Wind-down · journal", tag: "HABIT" },
  ] satisfies TimelineItem[],
};

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Eyebrow date, e.g. "FRIDAY · MAY 8" (design README §Home). */
export function eyebrowDate(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Day progress 0–100 through the 6:00–23:00 wake window (design README §Home). */
export function dayProgressPct(d: Date = new Date()): number {
  const wakeMin = 6 * 60;
  const sleepMin = 23 * 60;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const pct = ((minutes - wakeMin) / (sleepMin - wakeMin)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Greeting lead by time of day (design README §Home: morning/afternoon/evening). */
export function greetingLead(d: Date = new Date()): string {
  const hour = d.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Live Home vitals — Whoop recovery/sleep/HRV/rest-HR + real habit tally. Net worth stays mock. */
export type LiveHome = {
  recoveryScore: number | null;
  hrv: number | null;
  restHr: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  /** Habit tally for today; null while the query is still loading. */
  habits: { done: number; total: number } | null;
};

/** Split decimal hours (7.2) into whole hours + zero-padded minutes ("7", "12"). */
function splitHours(decimalHours: number): { hours: string; minutes: string } {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

/**
 * Merge live values over the Home mock in place (HomeScreen reads
 * `homeData.*` at render time). Idempotent + null-safe: any null field keeps
 * its mock value. Net worth and the TODAY ledger are never touched.
 */
export function applyLiveHome(live: LiveHome): void {
  const { recoveryScore, hrv, restHr, sleepHours, sleepScore, habits } = live;

  if (recoveryScore != null) homeData.recovery.score = Math.round(recoveryScore);
  if (hrv != null) homeData.hrv.ms = Math.round(hrv);
  if (restHr != null) homeData.hrv.restHr = Math.round(restHr);

  if (sleepHours != null) {
    const { hours, minutes } = splitHours(sleepHours);
    homeData.vitals.sleep.hours = hours;
    homeData.vitals.sleep.minutes = minutes;
  }
  if (sleepScore != null) homeData.vitals.sleep.sub = `${Math.round(sleepScore)}% QUAL`;

  // `habits` is null only while loading; an empty result ({done:0,total:0}) must
  // write through, else a user with no habits keeps the mock tally forever.
  if (habits) {
    homeData.vitals.habits.done = habits.done;
    homeData.vitals.habits.total = habits.total;
  }
}
