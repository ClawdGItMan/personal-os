/**
 * mapWorkout: converts a raw HAE workout object into a partial workouts row.
 *
 * Capture-gated: the exact workout field names below (id, name, start, end,
 * duration, heartRate, activeEnergyBurned, totalEnergy, distance) are from the
 * plan's documented shape and must be confirmed against a real HAE push. Whether
 * HAE's workout id is durable across re-pushes also needs confirmation at capture.
 *
 * The rounding, kcal→kJ conversion, deterministic external_id synthesis, and
 * drop-null contract are fixed and tested.
 */

import { createHash } from "node:crypto";

export interface WorkoutRow {
  source: "apple_health";
  external_id: string;
  sport: string;
  started_at: string;
  ended_at?: string;
  duration_sec?: number;
  avg_hr?: number;
  max_hr?: number;
  energy_kj?: number;
  distance_m?: number;
  strain: null;
  source_metadata: Record<string, unknown>;
}

type RawWorkout = Record<string, unknown>;

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Parse a HAE timestamp ("yyyy-MM-dd HH:mm:ss Z") into an ISO 8601 string.
 * HAE uses a format like "2026-06-05 12:00:00 -0700" — replace the space with T
 * and clean up the offset to get a valid ISO timestamp.
 * Capture-gated: confirm the exact timestamp format against a real HAE push.
 */
function parseHaeTimestamp(ts: string): string {
  // "2026-06-05 12:00:00 -0700" → "2026-06-05T12:00:00-07:00"
  // HAE uses TWO spaces: date|time and time|offset. Replace the first with "T",
  // strip the second, then insert a colon in the offset → valid ISO timestamptz.
  return ts
    .replace(" ", "T") // date|time separator
    .replace(" ", "") // strip space before tz offset
    .replace(/([+-])(\d{2})(\d{2})$/, "$1$2:$3"); // -0700 → -07:00
}

/**
 * Synthesize a deterministic external_id from workout start, name, and duration.
 * Format: "ah_<hex-prefix-of-sha256(start|name|duration)>"
 * Returns null if start is not available (too sparse to be stable across re-pushes).
 */
function synthesizeExternalId(raw: RawWorkout): string | null {
  const start = typeof raw["start"] === "string" ? raw["start"] : null;
  if (!start) return null; // no stable anchor — drop the workout (caller returns null)
  const name = typeof raw["name"] === "string" ? raw["name"] : "";
  const duration = raw["duration"] != null ? String(raw["duration"]) : "";
  const input = `${start}|${name}|${duration}`;
  const hash = createHash("sha256").update(input, "utf8").digest("hex");
  return `ah_${hash}`;
}

/**
 * Map a single raw HAE workout object into a workouts row.
 * Returns null if the workout is too sparse to produce a stable external_id
 * (no HAE id and no start timestamp).
 */
export function mapWorkout(raw: RawWorkout): WorkoutRow | null {
  // --- external_id ---
  // Use HAE's durable id if present (capture-gated: confirm id durability across re-pushes).
  // Otherwise synthesize from start|name|duration. Return null if synthesis is impossible.
  const rawId = raw["id"];
  let externalId: string;
  if (rawId && typeof rawId === "string" && rawId.trim() !== "") {
    externalId = rawId;
  } else {
    const synthesized = synthesizeExternalId(raw);
    if (synthesized === null) return null;
    externalId = synthesized;
  }

  // --- sport ---
  // Capture-gated: confirm HAE workout name strings (e.g. "Running", "Cycling").
  const rawName = typeof raw["name"] === "string" ? raw["name"] : "";
  const sport = rawName.toLowerCase().trim() || "workout";

  // --- started_at / ended_at ---
  // Capture-gated: confirm "start" and "end" field names + timestamp format.
  const rawStart = raw["start"];
  const rawEnd = raw["end"];
  const startStr = typeof rawStart === "string" ? rawStart : null;
  const endStr = typeof rawEnd === "string" ? rawEnd : null;

  // started_at is `timestamptz NOT NULL` — a workout with no parseable start
  // can never produce a valid row, so drop it even if a raw HAE id was present
  // (the rawId path above does NOT guarantee a start).
  if (!startStr) return null;
  const started_at = parseHaeTimestamp(startStr);

  const row: Partial<WorkoutRow> & { source: "apple_health"; external_id: string; strain: null; source_metadata: Record<string, unknown> } = {
    source: "apple_health",
    external_id: externalId,
    sport,
    started_at,
    strain: null,
    source_metadata: {},
  };

  if (endStr) {
    row.ended_at = parseHaeTimestamp(endStr);
  }

  // --- duration_sec ---
  // Capture-gated: confirm "duration" is in seconds.
  if (raw["duration"] != null && typeof raw["duration"] === "number") {
    row.duration_sec = Math.round(raw["duration"]);
  }

  // --- heart rate ---
  // Capture-gated: confirm "heartRate.avg.qty" and "heartRate.max.qty" field nesting.
  const heartRate = raw["heartRate"] as Record<string, unknown> | undefined;
  if (heartRate && typeof heartRate === "object") {
    const avg = heartRate["avg"] as Record<string, unknown> | undefined;
    const max = heartRate["max"] as Record<string, unknown> | undefined;
    if (avg && typeof avg["qty"] === "number") {
      row.avg_hr = Math.round(avg["qty"] as number);
    }
    if (max && typeof max["qty"] === "number") {
      row.max_hr = Math.round(max["qty"] as number);
    }
  }

  // --- energy ---
  // Capture-gated: confirm whether HAE uses "activeEnergyBurned" or "totalEnergy",
  // and whether the units field is present on the nested object.
  // kcal → kJ: multiply by 4.184, round to 1 dp. If already kJ, store directly.
  const energyFields = ["activeEnergyBurned", "totalEnergy"] as const;
  for (const field of energyFields) {
    const energyObj = raw[field] as Record<string, unknown> | undefined;
    if (energyObj && typeof energyObj["qty"] === "number") {
      const qty = energyObj["qty"] as number;
      const units = typeof energyObj["units"] === "string" ? energyObj["units"] : "kcal";
      if (units === "kcal") {
        row.energy_kj = round(qty * 4.184, 1);
      } else {
        // Assume kJ or kJ-equivalent — store directly rounded to 1 dp.
        row.energy_kj = round(qty, 1);
      }
      break; // use the first energy field found
    }
  }

  // --- distance ---
  // Capture-gated: confirm "distance.qty" and units (meters or km).
  // The plan says "→ metres if needed; round 1 dp" — assume HAE sends metres for now.
  const distanceObj = raw["distance"] as Record<string, unknown> | undefined;
  if (distanceObj && typeof distanceObj["qty"] === "number") {
    row.distance_m = round(distanceObj["qty"] as number, 1);
  }

  return row as WorkoutRow;
}
