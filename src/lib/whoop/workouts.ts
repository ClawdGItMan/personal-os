import { paginate } from "./client";

/**
 * Whoop workouts transform layer: fetch a window of workout records and reduce
 * them to `workouts` rows.
 *
 * Docs (verified 2026-06-05): https://developer.whoop.com — see
 * `.tmp/whoop-api-facts.md` for the exact field dot-paths used below.
 *
 * Like `src/lib/whoop/health.ts`, this is a thin HTTP/transform layer: it never
 * touches Supabase or tokens directly. The novel transform logic lives in the
 * pure, tested `mapWorkout` so the sync core (Task 6) stays simple.
 *
 * v2 deviation from older docs: workouts expose `sport_name` (a string, e.g.
 * `"running"`). `sport_id` (the integer) is SUNSET (09/01/2025) and there is no
 * authoritative id→name enum — so we consume `sport_name` directly and fall
 * back to `"workout"` when it's missing/empty. NO numeric sport lookup.
 *
 * Always gate `score.*` reads on `score_state === "SCORED"` — the score object
 * may be absent otherwise. Unlike the health partial-merge, the workouts upsert
 * is a PLAIN upsert on `(user_id, source, external_id)` (single-source-owned),
 * so absent metrics are stored as `null` rather than omitted.
 */

const MILLIS_PER_SECOND = 1000;

// ---------------------------------------------------------------------------
// Raw record shape (lightly typed — only the fields we consume).
// ---------------------------------------------------------------------------

type ScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE" | string;

/** Workout record — `id` is a UUID string (this is `external_id`). */
export interface WhoopWorkout {
  id: string;
  sport_name?: string;
  start: string;
  end?: string;
  score_state?: ScoreState;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    distance_meter?: number;
  };
}

export interface WorkoutWindow {
  start: string;
  end: string;
}

/** Normalized, flat camelCase input to `mapWorkout` (one per workout). */
export interface NormalizedWorkout {
  id?: string;
  sportName?: string;
  start?: string;
  end?: string;
  strain?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  kilojoules?: number;
  distanceMeters?: number;
}

/** A `workouts` row (sans `user_id`, added by the sync core). */
export interface WorkoutRow {
  source: "whoop";
  external_id: string;
  sport: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  energy_kj: number | null;
  distance_m: number | null;
  source_metadata: Record<string, never>;
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** Rounds to 1 decimal place (for `strain` / `energy_kj`). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Whole-second duration from `start`→`end`; null if `end` is absent. */
function durationSec(start: string, end: string | undefined): number | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / MILLIS_PER_SECOND);
}

/**
 * Maps a normalized workout to a `workouts` row, or `null` to drop it.
 *
 * Drops (returns `null`) when `id` is missing/falsy — we never insert a null
 * `external_id`. Otherwise: `sport` = `sportName` (trimmed), falling back to
 * `"workout"` when missing/empty; `avg_hr`/`max_hr` rounded to integers;
 * `strain`/`energy_kj` rounded to one decimal; `duration_sec` is whole seconds
 * (null when `end` is absent). Absent optional metrics become `null` (the
 * workouts upsert is single-source-owned, so nulls are safe). `source_metadata`
 * is always `{}` (the column is `not null default '{}'` — never null).
 */
export function mapWorkout(input: NormalizedWorkout): WorkoutRow | null {
  if (!input.id) return null;
  if (!input.start) return null;

  const sportName = input.sportName?.trim();
  const sport = sportName ? sportName : "workout";

  return {
    source: "whoop",
    external_id: input.id,
    sport,
    started_at: input.start,
    ended_at: input.end ?? null,
    duration_sec: durationSec(input.start, input.end),
    strain: input.strain !== undefined ? round1(input.strain) : null,
    avg_hr: input.averageHeartRate !== undefined ? Math.round(input.averageHeartRate) : null,
    max_hr: input.maxHeartRate !== undefined ? Math.round(input.maxHeartRate) : null,
    energy_kj: input.kilojoules !== undefined ? round1(input.kilojoules) : null,
    distance_m: input.distanceMeters ?? null,
    source_metadata: {},
  };
}

/** True only when a record is SCORED (gate for reading `score.*`). */
function isScored(record: { score_state?: ScoreState } | undefined): boolean {
  return record?.score_state === "SCORED";
}

/**
 * Normalizes a raw v2 workout record into the flat camelCase shape `mapWorkout`
 * consumes, extracting score-derived metrics only when the record is SCORED.
 * A workout without a SCORED score still has id/sport/start/end — it's kept; the
 * score-derived metrics are simply left undefined (→ null in the mapped row).
 */
function normalizeWorkout(raw: WhoopWorkout): NormalizedWorkout {
  const normalized: NormalizedWorkout = {
    id: raw.id,
    sportName: raw.sport_name,
    start: raw.start,
    end: raw.end,
  };

  if (isScored(raw) && raw.score) {
    normalized.strain = raw.score.strain;
    normalized.averageHeartRate = raw.score.average_heart_rate;
    normalized.maxHeartRate = raw.score.max_heart_rate;
    normalized.kilojoules = raw.score.kilojoule;
    normalized.distanceMeters = raw.score.distance_meter;
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Fetch.
// ---------------------------------------------------------------------------

/**
 * Fetches the workouts for `[start, end)` (ISO-8601 UTC; `start` inclusive,
 * `end` exclusive), paginating with the max page size (25). Each raw v2 record
 * is normalized and mapped; dropped (`null`) rows are filtered out. Returns the
 * `workouts` rows (sans `user_id`, which the sync core adds).
 */
export async function fetchWorkouts(
  accessToken: string,
  { start, end }: WorkoutWindow,
): Promise<WorkoutRow[]> {
  const raw = await paginate<WhoopWorkout>(accessToken, "activity/workout", {
    start,
    end,
    limit: 25,
  });

  return raw
    .map((record) => mapWorkout(normalizeWorkout(record)))
    .filter((row): row is WorkoutRow => row !== null);
}
