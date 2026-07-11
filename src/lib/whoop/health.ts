import { paginate } from "./client";

/**
 * Whoop health transform layer: fetch a window of recovery/cycle/sleep records
 * and reduce them to partial `health_snapshots` rows.
 *
 * Docs (verified 2026-06-05): https://developer.whoop.com — see
 * `.tmp/whoop-api-facts.md` for the exact field dot-paths used below.
 *
 * Like `src/lib/google/calendar.ts`, this is a thin HTTP/transform layer: it
 * never touches Supabase or tokens directly. The novel join + date logic lives
 * in the pure, tested functions `whoopDayDate` / `assembleHealthDays` so the
 * sync core (Task 6) stays simple.
 *
 * Always gate `score.*` reads on `score_state === "SCORED"` — the score object
 * may be absent otherwise. A field is only emitted when its source record is
 * SCORED and the value is present, so the partial upsert (Task 6) never nulls
 * metrics owned by other sources (e.g. weight/steps).
 */

const MILLIS_PER_HOUR = 3_600_000;
const MILLIS_PER_MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Raw record shapes (lightly typed — only the fields we consume).
// ---------------------------------------------------------------------------

type ScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE" | string;

/** Cycle record — wake-anchored "day"; `id` is an integer (not a UUID). */
export interface WhoopCycle {
  id: number;
  start: string;
  timezone_offset?: string;
  score_state?: ScoreState;
  score?: { strain?: number };
}

/** Recovery record — links a cycle (`cycle_id`, int) to its sleep (`sleep_id`, uuid). */
export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  score_state?: ScoreState;
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
  };
}

/** Sleep record — `id` is a UUID; `nap` distinguishes naps from the night's sleep.
 * `start`/`end` bound the sleep window (same shape as `WhoopWorkout`'s window). */
export interface WhoopSleep {
  id: string;
  nap?: boolean;
  start?: string;
  end?: string;
  score_state?: ScoreState;
  score?: {
    sleep_performance_percentage?: number;
    stage_summary?: {
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      total_awake_time_milli?: number;
    };
  };
}

export interface HealthWindow {
  start: string;
  end: string;
}

export interface RawHealthRecords {
  cycles: WhoopCycle[];
  recoveries: WhoopRecovery[];
  sleeps: WhoopSleep[];
}

/** Normalized, flat camelCase input to `mapHealthDay` (one per cycle/day).
 * `sleepDeepMin`/`sleepRemMin`/`sleepLightMin`/`sleepAwakeMin` are unrounded
 * minutes (ms / 60,000) — `mapHealthDay` rounds them, mirroring `sleepHours`. */
export interface NormalizedHealthDay {
  date: string;
  recoveryScore?: number;
  dayStrain?: number;
  sleepPerformance?: number;
  sleepHours?: number;
  hrv?: number;
  rhr?: number;
  sleepStart?: string;
  sleepEnd?: string;
  sleepDeepMin?: number;
  sleepRemMin?: number;
  sleepLightMin?: number;
  sleepAwakeMin?: number;
}

/** A partial `health_snapshots` row (sans `user_id`, added by the sync core). */
export interface HealthSnapshotRow {
  date: string;
  source: "whoop";
  recovery_score?: number;
  strain?: number;
  sleep_score?: number;
  sleep_hours?: number;
  hrv?: number;
  rhr?: number;
  sleep_start?: string;
  sleep_end?: string;
  sleep_deep_min?: number;
  sleep_rem_min?: number;
  sleep_light_min?: number;
  sleep_awake_min?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/**
 * Returns the local calendar date (`"YYYY-MM-DD"`) for an ISO-UTC timestamp in
 * `timeZone`, using `Intl.DateTimeFormat`. Mirrors CalendarList's fallback: an
 * invalid `timeZone` falls back to UTC rather than throwing (so a bad
 * `profiles.timezone` never breaks a sync).
 *
 * The `en-CA` locale yields `YYYY-MM-DD` directly.
 */
export function whoopDayDate(isoTimestamp: string, timeZone: string): string {
  const date = new Date(isoTimestamp);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

/** True only when a record is SCORED (gate for reading `score.*`). */
function isScored(record: { score_state?: ScoreState } | undefined): boolean {
  return record?.score_state === "SCORED";
}

/**
 * Derives total sleep hours from a sleep's stage summary.
 *
 * NOTE: Whoop exposes NO dedicated total-sleep field, so this is an INFERRED
 * derivation (light + slow-wave + REM, ÷ 3,600,000 ms/hour) — confirm against a
 * live response at acceptance. Returns `undefined` if no stage data is present.
 */
function deriveSleepHours(sleep: WhoopSleep): number | undefined {
  const stages = sleep.score?.stage_summary;
  if (!stages) return undefined;
  const light = stages.total_light_sleep_time_milli;
  const slowWave = stages.total_slow_wave_sleep_time_milli;
  const rem = stages.total_rem_sleep_time_milli;
  if (light === undefined && slowWave === undefined && rem === undefined) {
    return undefined;
  }
  return ((light ?? 0) + (slowWave ?? 0) + (rem ?? 0)) / MILLIS_PER_HOUR;
}

/**
 * Joins recovery↔cycle↔sleep into one normalized object per cycle (the day
 * spine). For each cycle: `date = whoopDayDate(cycle.start, timeZone)`; the
 * recovery is matched on `recovery.cycle_id === cycle.id`; the night's sleep on
 * `sleep.id === recovery.sleep_id`, skipping naps.
 *
 * A field is included ONLY when its source record is SCORED and the value is
 * present — absent fields are omitted (never set to undefined/null) so the
 * partial upsert won't null other sources' columns. This applies per-field to
 * the sleep-stage breakdown too: `sleepStart`/`sleepEnd`/`sleepDeepMin`/
 * `sleepRemMin`/`sleepLightMin`/`sleepAwakeMin` are each set independently when
 * present on a SCORED, non-nap sleep — a stage_summary missing one field (e.g.
 * awake) omits just that one, not the whole group. Stage minutes are left
 * UNROUNDED here (ms / 60,000); `mapHealthDay` rounds them, mirroring `sleepHours`.
 */
export function assembleHealthDays(
  { cycles, recoveries, sleeps }: RawHealthRecords,
  timeZone: string,
): NormalizedHealthDay[] {
  const recoveryByCycle = new Map<number, WhoopRecovery>();
  for (const recovery of recoveries) recoveryByCycle.set(recovery.cycle_id, recovery);

  const sleepById = new Map<string, WhoopSleep>();
  for (const sleep of sleeps) sleepById.set(sleep.id, sleep);

  return cycles.map((cycle) => {
    const day: NormalizedHealthDay = { date: whoopDayDate(cycle.start, timeZone) };

    if (isScored(cycle) && cycle.score?.strain !== undefined) {
      day.dayStrain = cycle.score.strain;
    }

    const recovery = recoveryByCycle.get(cycle.id);
    if (recovery && isScored(recovery)) {
      if (recovery.score?.recovery_score !== undefined) {
        day.recoveryScore = recovery.score.recovery_score;
      }
      if (recovery.score?.hrv_rmssd_milli !== undefined) {
        day.hrv = recovery.score.hrv_rmssd_milli;
      }
      if (recovery.score?.resting_heart_rate !== undefined) {
        day.rhr = recovery.score.resting_heart_rate;
      }
    }

    // The night's sleep is the recovery's linked sleep — but never a nap.
    const sleep = recovery ? sleepById.get(recovery.sleep_id) : undefined;
    if (sleep && !sleep.nap && isScored(sleep)) {
      if (sleep.score?.sleep_performance_percentage !== undefined) {
        day.sleepPerformance = sleep.score.sleep_performance_percentage;
      }
      const sleepHours = deriveSleepHours(sleep);
      if (sleepHours !== undefined) day.sleepHours = sleepHours;

      if (sleep.start !== undefined) day.sleepStart = sleep.start;
      if (sleep.end !== undefined) day.sleepEnd = sleep.end;

      const stages = sleep.score?.stage_summary;
      if (stages?.total_slow_wave_sleep_time_milli !== undefined) {
        day.sleepDeepMin = stages.total_slow_wave_sleep_time_milli / MILLIS_PER_MINUTE;
      }
      if (stages?.total_rem_sleep_time_milli !== undefined) {
        day.sleepRemMin = stages.total_rem_sleep_time_milli / MILLIS_PER_MINUTE;
      }
      if (stages?.total_light_sleep_time_milli !== undefined) {
        day.sleepLightMin = stages.total_light_sleep_time_milli / MILLIS_PER_MINUTE;
      }
      if (stages?.total_awake_time_milli !== undefined) {
        day.sleepAwakeMin = stages.total_awake_time_milli / MILLIS_PER_MINUTE;
      }
    }

    return day;
  });
}

/** Rounds to 1 decimal place (for `strain` / `sleep_hours`). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Maps a normalized day to a partial `health_snapshots` row.
 *
 * Rounds `recovery_score`/`sleep_score`/`hrv`/`rhr`/`sleep_deep_min`/
 * `sleep_rem_min`/`sleep_light_min`/`sleep_awake_min` to integers and
 * `strain`/`sleep_hours` to one decimal. `sleep_start`/`sleep_end` pass through
 * unchanged (timestamps). ALWAYS sets `date` and `source`; includes a metric key
 * ONLY when its normalized input is present (non-undefined) — so the partial
 * upsert won't null metrics owned by other sources.
 */
export function mapHealthDay(input: NormalizedHealthDay): HealthSnapshotRow {
  const row: HealthSnapshotRow = { date: input.date, source: "whoop" };

  if (input.recoveryScore !== undefined) row.recovery_score = Math.round(input.recoveryScore);
  if (input.dayStrain !== undefined) row.strain = round1(input.dayStrain);
  if (input.sleepPerformance !== undefined) row.sleep_score = Math.round(input.sleepPerformance);
  if (input.sleepHours !== undefined) row.sleep_hours = round1(input.sleepHours);
  if (input.hrv !== undefined) row.hrv = Math.round(input.hrv);
  if (input.rhr !== undefined) row.rhr = Math.round(input.rhr);
  if (input.sleepStart !== undefined) row.sleep_start = input.sleepStart;
  if (input.sleepEnd !== undefined) row.sleep_end = input.sleepEnd;
  if (input.sleepDeepMin !== undefined) row.sleep_deep_min = Math.round(input.sleepDeepMin);
  if (input.sleepRemMin !== undefined) row.sleep_rem_min = Math.round(input.sleepRemMin);
  if (input.sleepLightMin !== undefined) row.sleep_light_min = Math.round(input.sleepLightMin);
  if (input.sleepAwakeMin !== undefined) row.sleep_awake_min = Math.round(input.sleepAwakeMin);

  return row;
}

// ---------------------------------------------------------------------------
// Fetch.
// ---------------------------------------------------------------------------

/**
 * Fetches the raw recovery + cycle + sleep records for `[start, end)` (ISO-8601
 * UTC; `start` inclusive, `end` exclusive). Paginates each collection with the
 * max page size (25). Returns the raw records; `assembleHealthDays` joins them.
 */
export async function fetchHealthWindow(
  accessToken: string,
  { start, end }: HealthWindow,
): Promise<RawHealthRecords> {
  const params = { start, end, limit: 25 };

  const [cycles, recoveries, sleeps] = await Promise.all([
    paginate<WhoopCycle>(accessToken, "cycle", params),
    paginate<WhoopRecovery>(accessToken, "recovery", params),
    paginate<WhoopSleep>(accessToken, "activity/sleep", params),
  ]);

  return { cycles, recoveries, sleeps };
}
