/**
 * mapMetricsToDays: converts HAE metric arrays into partial health_snapshots rows.
 *
 * Design: mirrors src/lib/whoop/health.ts's "build a partial row, include a key
 * only when present" discipline — the partial upsert never nulls another source's
 * columns (Whoop's recovery_score/strain, manual vo2_max, etc.).
 *
 * Capture-gated: the exact HAE metric name strings and units strings below are
 * wired from the plan's documented values and must be confirmed against a real
 * HAE push before the acceptance gate. The rounding, unit-conversion, omit-absent-
 * keys, and local-date-keying contract is fixed and tested.
 *
 * Overlap note: rhr/hrv/sleep_hours are shared with Whoop — last-write-wins in v1
 * (no priority arbitration). The partial upsert sets only the Apple-owned columns
 * present in this payload, so whichever source syncs last for a day wins those
 * columns without disturbing the other's columns.
 */

import type { HaeMetric } from "./parser";

export interface HealthDayRow {
  date: string;
  source: "apple_health";
  [key: string]: unknown;
}

/**
 * Extract the local date string ("YYYY-MM-DD") from HAE's timestamp format.
 * HAE already aggregates per local day and sends "yyyy-MM-dd HH:mm:ss Z".
 * We take the leading 10 characters — no server-side tz recompute needed.
 * Capture-gated: confirm the timestamp format against a real HAE push.
 */
function localDate(haeTimestamp: string): string {
  return haeTimestamp.slice(0, 10);
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Map a parsed HAE metrics array into an array of partial health_snapshots rows,
 * one per local day. Each row contains only the columns for metrics present in
 * this payload — absent metrics are not set at all (not set to null), so the
 * partial upsert ON CONFLICT DO UPDATE preserves other sources' columns.
 */
export function mapMetricsToDays(metrics: HaeMetric[]): HealthDayRow[] {
  // Map<localDate, partialRow>
  const days = new Map<string, HealthDayRow>();

  function getDay(date: string): HealthDayRow {
    if (!days.has(date)) {
      days.set(date, { date, source: "apple_health" });
    }
    return days.get(date)!;
  }

  for (const metric of metrics) {
    const { name, units, data } = metric;

    switch (name) {
      case "step_count": {
        // Capture-gated: confirm "step_count" is HAE's exact name string.
        // Aggregate: sum all samples in the same local day; round to int.
        for (const sample of data) {
          if (sample.qty == null) continue;
          const date = localDate(sample.date);
          const row = getDay(date);
          const current = typeof row.steps === "number" ? row.steps : 0;
          row.steps = current + sample.qty;
        }
        // Round to int after all samples for the day are accumulated
        for (const [, row] of days) {
          if (typeof row.steps === "number") {
            row.steps = Math.round(row.steps);
          }
        }
        break;
      }

      case "resting_heart_rate": {
        // Capture-gated: confirm "resting_heart_rate" + units "bpm" or "count/min".
        // HAE sends a daily-aggregated value; take the most recent sample's qty.
        // Overlap with Whoop: last-write-wins (see module comment).
        for (const sample of data) {
          if (sample.qty == null) continue;
          const date = localDate(sample.date);
          const row = getDay(date);
          row.rhr = Math.round(sample.qty);
        }
        break;
      }

      case "heart_rate_variability": {
        // Capture-gated: confirm "heart_rate_variability" + units "ms".
        // Overlap with Whoop: last-write-wins.
        for (const sample of data) {
          if (sample.qty == null) continue;
          const date = localDate(sample.date);
          const row = getDay(date);
          row.hrv = Math.round(sample.qty);
        }
        break;
      }

      case "sleep_analysis": {
        // Capture-gated: confirm "sleep_analysis"; prefer the "asleep" sub-field
        // (time actually asleep) to match Whoop's sleep-duration semantics.
        // HAE may send {date, asleep: qty} or {date, qty: asleep_hours}.
        // Overlap with Whoop: last-write-wins.
        for (const sample of data) {
          // Try the "asleep" named field first; fall back to qty for older HAE versions.
          // Capture-gated: confirm whether HAE sends asleep as a named field or qty.
          const raw = sample as Record<string, unknown>;
          const asleepQty =
            typeof raw["asleep"] === "number"
              ? (raw["asleep"] as number)
              : typeof sample.qty === "number"
              ? sample.qty
              : null;
          if (asleepQty == null) continue;
          const date = localDate(sample.date);
          const row = getDay(date);
          row.sleep_hours = round(asleepQty, 1);
        }
        break;
      }

      case "weight_body_mass":
      // Capture-gated: HAE may also use "body_mass" — confirm the exact name.
      case "body_mass": {
        // Store the native value (no conversion); set weight_unit per units string.
        // lb → "lbs", kg → "kg". Round to 2 decimal places.
        for (const sample of data) {
          if (sample.qty == null) continue;
          const date = localDate(sample.date);
          const row = getDay(date);
          row.weight = round(sample.qty, 2);
          row.weight_unit = units === "lb" ? "lbs" : "kg";
        }
        break;
      }

      case "active_energy": {
        // Option A (resolved): active_energy is selected in HAE and parsed, but
        // health_snapshots has no active-calories column in v1 — do NOT emit any
        // column. We still call getDay() so the date appears if it is the only
        // metric for that day (the row will have only date+source, which is a no-op
        // upsert — harmless).
        // Capture-gated: confirm "active_energy" + units "kcal" or "kJ".
        for (const sample of data) {
          if (sample.qty == null) continue;
          // Intentionally only ensure the day exists without setting any column.
          getDay(localDate(sample.date));
        }
        break;
      }

      default:
        // Unknown metric — skip. The parser's passthrough ensures we see all names,
        // but we only map the ones in the plan's table.
        break;
    }
  }

  // Final pass: round step_count accumulators (handles multi-metric runs correctly).
  // (Steps are already rounded in the loop above; this is defensive.)
  for (const row of days.values()) {
    if (typeof row.steps === "number") {
      row.steps = Math.round(row.steps as number);
    }
  }

  return Array.from(days.values());
}
