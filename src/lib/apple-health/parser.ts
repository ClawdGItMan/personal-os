import { z } from "zod";

/**
 * Zod schema for a single HAE data sample.
 * qty is coerced so that numeric-string values ("8421") are accepted transparently.
 * Capture-gated: the exact field names (qty, date, source, value, asleep, …)
 * are confirmed against a real HAE push before locking.
 */
const HaeSampleSchema = z
  .object({
    date: z.string(),
    qty: z.coerce.number().optional(),
    // sleep_analysis sends "asleep", "inBed", etc. as sub-fields — passthrough preserves them
  })
  .passthrough();

/**
 * Zod schema for a single HAE metric entry.
 * Capture-gated: the exact metric name strings (step_count, active_energy, …)
 * and units strings (count, kcal, bpm, ms, hr, lb, kg) are confirmed at capture.
 */
const HaeMetricSchema = z.object({
  name: z.string(),
  units: z.string(),
  data: z.array(HaeSampleSchema),
});

/**
 * Zod schema for the full HAE payload.
 * - data.workouts defaults to [] so batched pushes (metrics-only) are tolerated.
 * - .passthrough() at the data level ignores unknown arrays HAE may include
 *   (stateOfMind, medications, symptoms, cycleTracking, ecg, heartRateNotifications, …).
 * - The outer object also uses passthrough for any top-level wrapper fields HAE may add.
 */
const HaePayloadSchema = z
  .object({
    data: z
      .object({
        metrics: z.array(HaeMetricSchema),
        workouts: z.array(z.record(z.string(), z.unknown())).default([]),
      })
      .passthrough(),
  })
  .passthrough();

export type HaeMetric = z.infer<typeof HaeMetricSchema>;
export type HaeSample = z.infer<typeof HaeSampleSchema>;
export type HaeWorkoutRaw = Record<string, unknown>;

export interface ParsedHaePayload {
  metrics: HaeMetric[];
  workouts: HaeWorkoutRaw[];
}

/**
 * Parse and validate a raw HAE (Health Auto Export) push payload.
 * Throws a ZodError on missing data.metrics; the route maps this to a 400.
 * Unknown top-level arrays (stateOfMind, symptoms, …) are silently ignored via passthrough.
 */
export function parseHaePayload(raw: unknown): ParsedHaePayload {
  const parsed = HaePayloadSchema.parse(raw);
  return {
    metrics: parsed.data.metrics,
    workouts: parsed.data.workouts as HaeWorkoutRaw[],
  };
}
