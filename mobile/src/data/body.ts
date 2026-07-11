/**
 * Body screen data — design README §Body (spec 7a). Recovery score, HRV, rest
 * HR, sleep hours, and sleep quality are LIVE via `useHealthToday` in
 * BodyScreen (Whoop `health_snapshots`); every export below has no data
 * provider yet, so it's a fixed mock matching the locked spec verbatim
 * (design_handoff_personal_os/README.md §Body, system-tokens.md). All times
 * are already 12-hour.
 */
import type { Palette } from "../theme/palette";

export type SleepStage = {
  key: "deep" | "rem" | "core";
  label: string;
  /** Fraction of total sleep, 0–1 — drives the stacked stage bar's width. */
  fraction: number;
  /** Legend duration text, e.g. "1:12". */
  duration: string;
};

export type WeekSessionState = "done" | "today" | "track";

export type WeekDay = {
  /** Single-letter weekday (M T W T F S S). */
  letter: string;
  state: WeekSessionState;
};

/** Recovery score shown before the first Whoop sync resolves. */
export const recoveryFallback = { score: 72 };

/** TRAINING · DONE band — no workout provider yet. */
export const trainingMock = {
  time: "11:00 AM",
  title: "Push day — 4 PRs",
  sub: "52 MIN · TONNAGE 12,480 LB",
}; // mock — no provider yet

/**
 * SLEEP · LAST NIGHT band. `hoursFallback`/`qualityFallback` back the live
 * sleepHours/sleepScore when a day's sync doesn't cover them; `window` and
 * `stages` stay mock always — Whoop sync gives total hours/score only, not a
 * sleep-window timestamp or a stage breakdown.
 */
export const sleepMock = {
  window: "10:58 PM → 6:10 AM",
  hoursFallback: 7.2,
  qualityFallback: 87,
  stages: [
    { key: "deep", label: "DEEP", fraction: 0.167, duration: "1:12" },
    { key: "rem", label: "REM", fraction: 0.25, duration: "1:48" },
    { key: "core", label: "CORE", fraction: 0.583, duration: "4:12" },
  ] satisfies SleepStage[],
}; // mock — no provider yet

/** REST HR stat — 7-day delta has no trend provider yet (Whoop gives today's point value only). */
export const restHRMock = { fallback: 48, delta: "−2 · 7D" }; // mock — no provider yet

/** HRV stat — "vs avg" delta has no trend provider yet. */
export const hrvMock = { fallback: 64, delta: "↑ +6 VS AVG" }; // mock — no provider yet

/** WEIGHT stat — no scale/HealthKit provider yet. */
export const weightMock = { value: "182.4", delta: "−0.6 · 30D" }; // mock — no provider yet

/** THIS WEEK session grid — no workout provider yet. */
export const weekMock = {
  sessions: 4,
  days: [
    { letter: "M", state: "done" },
    { letter: "T", state: "done" },
    { letter: "W", state: "track" },
    { letter: "T", state: "done" },
    { letter: "F", state: "today" },
    { letter: "S", state: "track" },
    { letter: "S", state: "track" },
  ] satisfies WeekDay[],
}; // mock — no provider yet

/** Split decimal hours (7.2) into "H:MM" (e.g. "7:12") for the sleep hero value. */
export function formatSleepHero(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** ISO-8601 week number (Mon-start, week 1 contains the year's first Thursday). */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Sleep state rule (design README): >7h accent green, 6–7h amber, <6h red. */
export function sleepColor(c: Palette, hours: number): string {
  if (hours > 7) return c.accent;
  if (hours >= 6) return c.amber;
  return c.red;
}
