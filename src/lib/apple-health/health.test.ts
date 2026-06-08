import { describe, it, expect } from "vitest";
import { mapMetricsToDays } from "./health";

describe("mapMetricsToDays", () => {
  it("maps + rounds present metrics, keys by local date, tags source", () => {
    const rows = mapMetricsToDays([
      { name: "step_count", units: "count", data: [
        { date: "2026-06-05 09:00:00 -0700", qty: 4000 },
        { date: "2026-06-05 18:00:00 -0700", qty: 4421 }, // same day → summed
      ] },
      { name: "weight_body_mass", units: "lb", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 181.44 }] },
      { name: "resting_heart_rate", units: "bpm", data: [{ date: "2026-06-05 06:00:00 -0700", qty: 54.6 }] },
    ]);
    const day = rows.find((r) => r.date === "2026-06-05")!;
    expect(day).toMatchObject({ date: "2026-06-05", source: "apple_health", steps: 8421, rhr: 55, weight: 181.44, weight_unit: "lbs" });
  });
  it("omits columns for absent metrics (partial upsert won't null them)", () => {
    const rows = mapMetricsToDays([{ name: "step_count", units: "count", data: [{ date: "2026-06-05 09:00:00 -0700", qty: 100 }] }]);
    const day = rows[0]!;
    expect(day.steps).toBe(100);
    expect("weight" in day).toBe(false);
    expect("hrv" in day).toBe(false);
    expect("rhr" in day).toBe(false);
  });
  it("converts kg weight and sets weight_unit accordingly", () => {
    const rows = mapMetricsToDays([{ name: "weight_body_mass", units: "kg", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 82.345 }] }]);
    expect(rows[0]!).toMatchObject({ weight: 82.35, weight_unit: "kg" }); // stored native, 2 decimals
  });
  it("does NOT emit any column for active_energy (option A — no column today)", () => {
    const rows = mapMetricsToDays([{ name: "active_energy", units: "kcal", data: [{ date: "2026-06-05 12:00:00 -0700", qty: 540 }] }]);
    // active_energy alone yields a day row with only date+source (or is skipped) — never an active_energy column.
    for (const r of rows) expect("active_energy" in r).toBe(false);
  });
  it("groups samples across multiple local days into separate rows", () => {
    const rows = mapMetricsToDays([{ name: "step_count", units: "count", data: [
      { date: "2026-06-04 23:00:00 -0700", qty: 200 },
      { date: "2026-06-05 01:00:00 -0700", qty: 300 },
    ] }]);
    expect(rows.map((r) => r.date).sort()).toEqual(["2026-06-04", "2026-06-05"]);
  });
});
