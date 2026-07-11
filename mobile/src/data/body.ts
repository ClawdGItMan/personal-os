/**
 * Body screen data helpers — design README §Body (spec 7a). Every band is now
 * LIVE (Whoop `health_snapshots` / `workouts` via `useHealthToday`,
 * `useSleepDetail`, `useWorkouts`, and the colocated `useBodyHistory` in
 * `components/body/`) — this file only holds pure formatting/derivation
 * helpers plus the small fixed fallbacks that still lack a trend provider
 * (REST HR/HRV 7-day deltas). All times are already 12-hour.
 */
import type { StatusSegment } from "../components/spec/TitleBlock";
import type { LatestWorkout, WorkoutDayCell } from "../lib/queries";
import type { Palette } from "../theme/palette";

/** One cell of the fixed Monday→Sunday "THIS WEEK" grid. `filled`/`isToday`
 * are independent (design README §Body: "today ringed" is unconditional,
 * "filled" only tracks whether the day has a logged workout) — a today with
 * no workout yet renders ringed-but-empty, not falsely filled. */
export type WeekDay = {
  /** Single-letter weekday (M T W T F S S). */
  letter: string;
  filled: boolean;
  isToday: boolean;
};

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Recovery score shown before the first Whoop sync resolves. */
export const recoveryFallback = { score: 72 };

/** REST HR stat — 7-day delta has no trend provider yet (Whoop gives today's point value only). */
export const restHRMock = { fallback: 48, delta: "−2 · 7D" }; // mock — no trend provider yet

/** HRV stat — "vs avg" delta has no trend provider yet. */
export const hrvMock = { fallback: 64, delta: "↑ +6 VS AVG" }; // mock — no trend provider yet

/** Minutes → "H:MM" (e.g. 72 → "1:12"). Shared by the sleep-stage legend and
 * the sleep-debt line — both start from raw minute counts. */
export function minutesToHm(totalMinutesRaw: number): string {
  const totalMinutes = Math.max(0, Math.round(totalMinutesRaw));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Split decimal hours (7.2) into "H:MM" (e.g. "7:12") for the sleep hero value. */
export function formatSleepHero(decimalHours: number): string {
  return minutesToHm(decimalHours * 60);
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

/** Local weekday index, Monday = 0 … Sunday = 6 (JS's `getDay()` is Sun = 0). */
export function daysSinceMonday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** "weightlifting" → "Weightlifting", "cross_training" → "Cross Training".
 * Whoop's `sport_name` (mapped to `workouts.sport` server-side) is a free
 * lowercase string with no numeric-id lookup (see `src/lib/whoop/workouts.ts`);
 * this just title-cases whatever comes back, splitting on space/underscore/
 * hyphen. Falls back to "Workout" for an empty/whitespace-only sport. */
export function titleCaseSport(sport: string): string {
  const words = sport
    .split(/[\s_-]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return "Workout";
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** TRAINING band sub: "{duration} MIN · STRAIN {strain}" — `t.bandSub` already
 * uppercases via textTransform. Missing fields render as "—" rather than a
 * fake number. */
export function formatTrainingSub(w: Pick<LatestWorkout, "durationSec" | "strain">): string {
  const minutes = w.durationSec != null ? Math.round(w.durationSec / 60) : null;
  const strain = w.strain != null ? w.strain.toFixed(1) : null;
  return `${minutes != null ? minutes : "—"} MIN · STRAIN ${strain != null ? strain : "—"}`;
}

/** Recovery-score state word for the status line (spec: green ≥67, red <34,
 * else amber) — same thresholds as `data/home.ts`'s `recoveryWord`. */
export function recoveryWord(score: number): "green" | "amber" | "red" {
  if (score >= 67) return "green";
  if (score >= 34) return "amber";
  return "red";
}

/** True when a workout's `startedAt` falls on today's local calendar day —
 * distinct from the TRAINING band's 7-day staleness check (`WORKOUT_STALE_MS`
 * in BodyScreen.tsx): the status line only credits a workout logged today. */
export function isWorkoutToday(startedAt: string, now: Date): boolean {
  const started = new Date(startedAt);
  return (
    started.getFullYear() === now.getFullYear() &&
    started.getMonth() === now.getMonth() &&
    started.getDate() === now.getDate()
  );
}

/**
 * Deterministic Body status-line segments (replaces the old canned "cleared
 * for the push day, logged this morning" copy): "Recovery's {word} — {sport}
 * logged." when a workout started today, else "Recovery's {word} — no
 * training yet today." `workoutSportToday` should be the title-cased sport of
 * today's latest workout (via `titleCaseSport` + `isWorkoutToday`), or null.
 */
export function bodyStatusSegments(recoveryScore: number, workoutSportToday: string | null): StatusSegment[] {
  const word = recoveryWord(recoveryScore);
  const clause = workoutSportToday ? ` — ${workoutSportToday} logged.` : " — no training yet today.";
  return ["Recovery's ", { b: word }, clause];
}

/**
 * Builds the fixed Monday→Sunday "THIS WEEK" grid from `useWorkouts`'s
 * rolling per-day window. `useWorkouts` only exposes a rolling N-day window
 * ending today (see the B1 data-layer report), not a calendar week — so the
 * screen calls `useWorkouts(daysSinceMonday(now) + 1)` to get exactly the
 * Monday-through-today slice (oldest first, ending today) and this function
 * appends the remaining future days (tomorrow…Sunday) as empty/untouched
 * `track` placeholders, since the future can't have logged workouts yet.
 */
export function buildWeekDays(mondayThroughToday: readonly WorkoutDayCell[]): WeekDay[] {
  const days: WeekDay[] = mondayThroughToday.map((cell, i) => ({
    letter: WEEKDAY_LETTERS[i] ?? "?",
    filled: cell.hasWorkout,
    isToday: cell.isToday,
  }));
  for (let i = days.length; i < 7; i++) {
    days.push({ letter: WEEKDAY_LETTERS[i] ?? "?", filled: false, isToday: false });
  }
  return days;
}

/** "N SESSIONS" header count — total workouts logged Monday…today (future
 * days can't contribute, so summing just the fetched window is exact). */
export function countWeekSessions(mondayThroughToday: readonly WorkoutDayCell[]): number {
  return mondayThroughToday.reduce((sum, cell) => sum + cell.count, 0);
}
