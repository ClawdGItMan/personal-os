import { paginateActivities } from "./client";

/**
 * Strava workouts transform layer: fetch a window of activities and reduce
 * them to `workouts` rows.
 *
 * Docs (verified 2026-06-08): https://developers.strava.com/docs/reference/
 * Endpoint: GET /athlete/activities
 * Response: bare JSON array of SummaryActivity objects.
 *
 * Key unit distinction (a real footgun):
 * - `after`/`before` params are epoch SECONDS (Strava API convention).
 * - `metadata.expires_at` (stored by oauth.ts) is epoch MILLISECONDS.
 * The sync core converts ms → seconds before calling `fetchActivities`; this
 * module only deals with seconds on the fetch side.
 *
 * `mapActivity` is a pure function so it can be unit-tested without HTTP.
 * `user_id` is NOT set here — the sync core injects it before upsert.
 */

// ---------------------------------------------------------------------------
// Sport normalization lookup.
// ---------------------------------------------------------------------------

/**
 * Maps Strava `sport_type` (and legacy `type`) enum values to our shared
 * normalized vocabulary. Aligns with Whoop's sport strings so ActivityList
 * reads consistently across providers.
 *
 * Enum source: https://developers.strava.com/docs/reference/ (SummaryActivity
 * sport_type enum, verified 2026-06-08).
 * Unknown values fall back to `raw.sport_type.toLowerCase()`.
 */
const STRAVA_SPORTS: Record<string, string> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Ride: "ride",
  MountainBikeRide: "ride",
  GravelRide: "ride",
  VirtualRide: "ride",
  EBikeRide: "ride",
  Swim: "swim",
  Walk: "walk",
  Hike: "hike",
  WeightTraining: "strength",
  Workout: "workout",
  Crossfit: "strength",
  Yoga: "yoga",
  Rowing: "row",
  Elliptical: "cardio",
};

// ---------------------------------------------------------------------------
// Raw record shape (lightly typed — only the fields we consume).
// Verified against https://developers.strava.com/docs/reference/ SummaryActivity.
// ---------------------------------------------------------------------------

/**
 * Strava SummaryActivity — only the subset of fields `mapActivity` reads.
 * All fields are optional to accommodate partial test fixtures; the mapper
 * validates what it actually needs (only `id` is hard-required).
 */
export interface StravaActivity {
  /** The activity's unique Strava ID. `external_id` is `String(id)`. */
  id?: number | string;
  /** Primary sport type string enum (preferred over legacy `type`). */
  sport_type?: string;
  /** Legacy type string — fallback when `sport_type` is absent. */
  type?: string;
  /** ISO-8601 UTC timestamp when the activity started. */
  start_date?: string;
  /** Wall-clock elapsed duration in seconds (used for `ended_at` derivation). */
  elapsed_time?: number;
  /** Active moving duration in seconds (preferred for `duration_sec`). */
  moving_time?: number;
  /** Activity distance in meters. */
  distance?: number;
  /** Whether this activity has heart-rate data. Omit HR fields when false. */
  has_heartrate?: boolean;
  /** Average heart rate (bpm). Only meaningful when `has_heartrate` is true. */
  average_heartrate?: number;
  /** Max heart rate (bpm). */
  max_heartrate?: number;
  /** Mechanical work output in kilojoules. */
  kilojoules?: number;
  /** Total elevation gain in meters (stored in source_metadata). */
  total_elevation_gain?: number;
  /** Average speed in m/s (stored in source_metadata). */
  average_speed?: number;
  /** Max speed in m/s (stored in source_metadata). */
  max_speed?: number;
  /** IANA timezone string (stored in source_metadata). */
  timezone?: string;
  /** UTC offset in seconds (stored in source_metadata). */
  utc_offset?: number;
}

/** A `workouts` row (sans `user_id`, injected by the sync core). */
export interface StravaWorkoutRow {
  source: "strava";
  external_id: string;
  sport: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  distance_m?: number;
  avg_hr?: number;
  max_hr?: number;
  energy_kj?: number;
  strain: null;
  source_metadata: {
    sport_type?: string;
    type?: string;
    timezone?: string;
    utc_offset?: number;
    total_elevation_gain?: number;
    average_speed?: number;
    max_speed?: number;
  };
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** Rounds to 1 decimal place (for `distance_m` / `energy_kj`). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Pure mapper.
// ---------------------------------------------------------------------------

/**
 * Maps a raw Strava SummaryActivity to a `workouts` row, or `null` to drop it.
 *
 * Returns `null` when `id` is missing/falsy — we never insert a null
 * `external_id` (the unique index treats NULLs as distinct, so every sync
 * would insert a duplicate).
 *
 * HR fields (`avg_hr`, `max_hr`) are OMITTED (not null) when `has_heartrate`
 * is false or the fields are absent — distinct from Whoop's plain-upsert null
 * pattern, because Strava activities without HR should not clobber a future
 * row that does have HR.
 *
 * `energy_kj` is OMITTED when `kilojoules` is absent.
 *
 * `strain` is always `null` (Whoop-specific metric; Strava has no equivalent).
 *
 * `user_id` is NOT set — injected by the sync core before upsert.
 */
export function mapActivity(raw: StravaActivity): StravaWorkoutRow | null {
  // Hard-require id — NULL external_id would duplicate on every sync.
  if (!raw.id) return null;

  const externalId = String(raw.id);

  // Sport normalization: prefer sport_type, fall back to type, unknown → lowercase raw.
  const sportKey = raw.sport_type ?? raw.type ?? "";
  const sport = STRAVA_SPORTS[sportKey] ?? sportKey.toLowerCase();

  const startedAt = raw.start_date ?? new Date(0).toISOString();

  // ended_at: start + elapsed_time*1000 (Strava has no explicit end field).
  const elapsedSec = raw.elapsed_time ?? 0;
  const endedAt = new Date(new Date(startedAt).getTime() + elapsedSec * 1000).toISOString();

  // duration_sec: moving_time preferred over elapsed_time.
  const durationSec = raw.moving_time ?? elapsedSec;

  const row: StravaWorkoutRow = {
    source: "strava",
    external_id: externalId,
    sport,
    started_at: startedAt,
    ended_at: endedAt,
    duration_sec: durationSec,
    strain: null,
    source_metadata: {
      ...(raw.sport_type !== undefined ? { sport_type: raw.sport_type } : {}),
      ...(raw.type !== undefined ? { type: raw.type } : {}),
      ...(raw.timezone !== undefined ? { timezone: raw.timezone } : {}),
      ...(raw.utc_offset !== undefined ? { utc_offset: raw.utc_offset } : {}),
      ...(raw.total_elevation_gain !== undefined
        ? { total_elevation_gain: raw.total_elevation_gain }
        : {}),
      ...(raw.average_speed !== undefined ? { average_speed: raw.average_speed } : {}),
      ...(raw.max_speed !== undefined ? { max_speed: raw.max_speed } : {}),
    },
  };

  // distance_m: round to 1 decimal; omit when absent.
  if (raw.distance !== undefined) {
    row.distance_m = round1(raw.distance);
  }

  // HR fields: omit entirely when has_heartrate is false OR field is absent.
  // (Strava sets has_heartrate=false when the device had no HR sensor.)
  const hasHr = raw.has_heartrate !== false; // true or undefined → include if field present
  if (hasHr && raw.average_heartrate !== undefined) {
    row.avg_hr = Math.round(raw.average_heartrate);
  }
  if (hasHr && raw.max_heartrate !== undefined) {
    row.max_hr = raw.max_heartrate;
  }

  // energy_kj: round to 1 decimal; omit when absent.
  if (raw.kilojoules !== undefined) {
    row.energy_kj = round1(raw.kilojoules);
  }

  return row;
}

// ---------------------------------------------------------------------------
// Fetch.
// ---------------------------------------------------------------------------

/** Window for activity fetches — epoch SECONDS (Strava API convention). */
export interface ActivityWindow {
  /** Epoch seconds — activities AFTER this timestamp. */
  after: number;
  /** Epoch seconds — activities BEFORE this timestamp. */
  before: number;
}

/**
 * Fetches all Strava activities in the given window (epoch SECONDS), paginating
 * via `paginateActivities` (MAX_PAGES=5, per_page=100 cap).
 *
 * Maps each raw SummaryActivity through `mapActivity`; drops nulls (missing id).
 * Returns `workouts` rows WITHOUT `user_id` — the sync core adds it before upsert.
 */
export async function fetchActivities(
  accessToken: string,
  { after, before }: ActivityWindow,
): Promise<StravaWorkoutRow[]> {
  const raw = await paginateActivities<StravaActivity>(accessToken, { after, before });
  return raw
    .map((activity) => mapActivity(activity))
    .filter((row): row is StravaWorkoutRow => row !== null);
}
