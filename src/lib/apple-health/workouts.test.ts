import { describe, it, expect } from "vitest";
import { mapWorkout } from "./workouts";

describe("mapWorkout", () => {
  it("uses HAE id when present; rounds HR; sets source/started_at", () => {
    const row = mapWorkout({
      id: "ABC-123", name: "Running",
      start: "2026-06-05 12:00:00 -0700", end: "2026-06-05 12:45:00 -0700",
      duration: 2700, heartRate: { avg: { qty: 142.6 }, max: { qty: 171.2 } },
    });
    expect(row).toMatchObject({ source: "apple_health", external_id: "ABC-123", duration_sec: 2700, avg_hr: 143, max_hr: 171, strain: null });
    expect(typeof row!.sport).toBe("string");
    expect(typeof row!.started_at).toBe("string"); // ISO
  });
  it("synthesizes a deterministic ah_ id when HAE id is absent (same input → same id)", () => {
    const input = { name: "Functional Strength Training", start: "2026-06-05 06:00:00 -0700", duration: 1800 };
    const a = mapWorkout(input)!; const b = mapWorkout({ ...input })!;
    expect(a.external_id).toBe(b.external_id);
    expect(a.external_id).toMatch(/^ah_[0-9a-f]+$/);
  });
  it("converts kcal energy to kJ (×4.184, 1 dp)", () => {
    const row = mapWorkout({ id: "x", name: "Cycling", start: "2026-06-05 12:00:00 -0700", duration: 600, activeEnergyBurned: { qty: 100, units: "kcal" } });
    expect(row!.energy_kj).toBe(418.4);
  });
  it("drops a workout that can't produce a non-null external_id (no id AND no start)", () => {
    expect(mapWorkout({ name: "Walking", duration: 100 })).toBeNull();
  });
});
