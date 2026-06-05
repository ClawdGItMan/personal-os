import { describe, it, expect } from "vitest";
import { mapWorkout } from "./workouts";

describe("mapWorkout", () => {
  it("maps a workout (rounds HR, kJ, sport_name → sport, source/external_id set)", () => {
    const row = mapWorkout({
      id: "w-123",
      sportName: "running",
      start: "2026-06-05T12:00:00Z",
      end: "2026-06-05T12:45:00Z",
      strain: 9.86,
      averageHeartRate: 142.6,
      maxHeartRate: 171.2,
      kilojoules: 1234.5,
    });
    expect(row).toMatchObject({
      source: "whoop",
      external_id: "w-123",
      started_at: "2026-06-05T12:00:00Z",
      duration_sec: 2700,
      strain: 9.9,
      avg_hr: 143,
      max_hr: 171,
      energy_kj: 1234.5,
      sport: "running",
    });
    expect(typeof row!.sport).toBe("string");
  });

  it("falls back to 'workout' when sport name is missing/empty", () => {
    const row = mapWorkout({ id: "w-9", start: "2026-06-05T12:00:00Z" });
    expect(row!.sport).toBe("workout");
  });

  it("drops a workout with no id (never insert a null external_id)", () => {
    expect(
      mapWorkout({ sportName: "running", start: "2026-06-05T12:00:00Z" }),
    ).toBeNull();
  });

  it("sets source_metadata to {} (never null) and ended_at/distance_m to null when absent", () => {
    const row = mapWorkout({ id: "w-7", start: "2026-06-05T12:00:00Z" });
    if (!row) throw new Error("expected a mapped row");
    expect(row.source_metadata).toEqual({});
    expect(row.ended_at).toBeNull();
    expect(row.duration_sec).toBeNull();
    expect(row.distance_m).toBeNull();
    // Absent optional metrics are null (single-source-owned plain upsert).
    expect(row.strain).toBeNull();
    expect(row.avg_hr).toBeNull();
    expect(row.max_hr).toBeNull();
    expect(row.energy_kj).toBeNull();
  });

  it("falls back to 'workout' when sport name is whitespace-only", () => {
    const row = mapWorkout({ id: "w-2", sportName: "   ", start: "2026-06-05T12:00:00Z" });
    expect(row!.sport).toBe("workout");
  });
});
