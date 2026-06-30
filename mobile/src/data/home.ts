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
