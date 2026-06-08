import { describe, it, expect } from "vitest";
import { mapActivity } from "./workouts";

describe("mapActivity", () => {
  it("maps a run (rounds HR, kJ, distance; derives ended_at; source/external_id set)", () => {
    const row = mapActivity({
      id: 12345678901,
      sport_type: "Run",
      type: "Run",
      start_date: "2026-06-05T12:00:00Z",
      elapsed_time: 2880, // 48 min wall clock
      moving_time: 2700, // 45 min active
      distance: 10123.45,
      has_heartrate: true,
      average_heartrate: 152.6,
      max_heartrate: 178,
      kilojoules: 1234.56,
    });
    expect(row).toMatchObject({
      source: "strava",
      external_id: "12345678901",
      sport: "run",
      started_at: "2026-06-05T12:00:00Z",
      ended_at: "2026-06-05T12:48:00.000Z", // start + elapsed_time
      duration_sec: 2700, // moving_time preferred
      distance_m: 10123.5, // rounded to 1 decimal
      avg_hr: 153, // Math.round
      max_hr: 178,
      energy_kj: 1234.6, // rounded to 1 decimal
    });
    expect(row!.strain).toBeNull();
  });

  it("normalizes sport_type via the lookup, falling back to lowercased raw for unknowns", () => {
    expect(mapActivity({ id: 1, sport_type: "MountainBikeRide", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("ride");
    expect(mapActivity({ id: 2, sport_type: "Kitesurf", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("kitesurf");
  });

  it("prefers sport_type but falls back to type when sport_type is absent", () => {
    expect(mapActivity({ id: 3, type: "Swim", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })!.sport).toBe("swim");
  });

  it("uses elapsed_time for duration when moving_time is absent", () => {
    expect(mapActivity({ id: 4, sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 1800 })!.duration_sec).toBe(1800);
  });

  it("omits HR/energy when absent or has_heartrate is false (don't write nulls/zeros)", () => {
    const row = mapActivity({ id: 5, sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60, has_heartrate: false, average_heartrate: 140 });
    expect("avg_hr" in row!).toBe(false);
    expect("max_hr" in row!).toBe(false);
    expect("energy_kj" in row!).toBe(false);
  });

  it("drops an activity with no id (never insert a null external_id)", () => {
    expect(mapActivity({ sport_type: "Run", start_date: "2026-06-05T00:00:00Z", elapsed_time: 60 })).toBeNull();
  });
});
