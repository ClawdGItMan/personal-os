/**
 * Sample Home data — same content as the approved home-v3 mockup.
 * Replaced by the live Supabase/provider backend when the data layer lands.
 */
export type TimelineState = "done" | "now" | "up";

export type TimelineItem = {
  time: string;
  state: TimelineState;
  title: string;
  sub: string;
  showConnector: boolean;
};

export const homeData = {
  eyebrow: "Friday · May 8 · Gulf UTC+4",
  greeting: { lead: "Good afternoon,", name: "Max." },
  whisper: "Recovery's green and your afternoon is clear until the Sequoia call.",
  dayProgress: 0.55,
  recoveryPct: 0.72,
  vitals: {
    recovery: { value: "72", sub: "HRV 64" },
    sleep: { hours: "7", minutes: "12", sub: "87% QUALITY" },
    netWorth: { value: "$2.83", suffix: "M", sub: "+0.03% · 30D" },
    habits: { done: 4, total: 6 },
  },
  today: { meta: "8 EVENTS · 3 DONE" },
  timeline: [
    { time: "09:30", state: "done", title: "Standup", sub: "Ops · 15 min", showConnector: true },
    { time: "10:00", state: "done", title: "1:1 · Sarah K", sub: "Calendar · done", showConnector: true },
    { time: "11:00", state: "done", title: "Train · push day", sub: "Body · 4 PRs logged", showConnector: true },
    { time: "NOW", state: "now", title: "Deep work — pricing model", sub: "In progress · 13:16", showConnector: true },
    { time: "17:00", state: "up", title: "Review compliance checklist", sub: "Focus · task", showConnector: true },
    { time: "19:00", state: "up", title: "Wind-down · journal", sub: "Focus · habit", showConnector: false },
  ] satisfies TimelineItem[],
};

/** Live Home vitals — Whoop recovery/sleep + real habit tally. Net worth stays mock (Plaid skipped). */
export type LiveHome = {
  recoveryScore: number | null;
  hrv: number | null;
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
 * Merge live values over the Home mock in place (VitalsStrip reads
 * `homeData.vitals.*` at render time). Idempotent + null-safe: any null field
 * keeps its mock value. Net worth is never touched.
 */
export function applyLiveHome(live: LiveHome): void {
  const { recoveryScore, hrv, sleepHours, sleepScore, habits } = live;

  if (recoveryScore != null) {
    homeData.recoveryPct = recoveryScore / 100;
    homeData.vitals.recovery.value = String(Math.round(recoveryScore));
  }
  if (hrv != null) homeData.vitals.recovery.sub = `HRV ${Math.round(hrv)}`;

  if (sleepHours != null) {
    const { hours, minutes } = splitHours(sleepHours);
    homeData.vitals.sleep.hours = hours;
    homeData.vitals.sleep.minutes = minutes;
  }
  if (sleepScore != null) homeData.vitals.sleep.sub = `${Math.round(sleepScore)}% QUALITY`;

  // `habits` is null only while loading; an empty result ({done:0,total:0}) must
  // write through, else a user with no habits keeps the mock tally forever.
  if (habits) {
    homeData.vitals.habits.done = habits.done;
    homeData.vitals.habits.total = habits.total;
  }
}
