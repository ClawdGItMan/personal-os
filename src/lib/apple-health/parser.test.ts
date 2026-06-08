import { describe, it, expect } from "vitest";
import { parseHaePayload } from "./parser";

describe("parseHaePayload", () => {
  it("parses a minimal metrics-only payload", () => {
    const out = parseHaePayload({ data: { metrics: [{ name: "step_count", units: "count", data: [{ date: "2026-06-05 00:00:00 -0700", qty: "8421" }] }] } });
    expect(out.metrics[0]!.name).toBe("step_count");
    expect(out.metrics[0]!.data[0]!.qty).toBe(8421); // coerced from string
    expect(out.workouts).toEqual([]);
  });
  it("ignores unknown top-level arrays (stateOfMind, symptoms, …)", () => {
    const out = parseHaePayload({ data: { metrics: [], workouts: [], stateOfMind: [{ x: 1 }], symptoms: [{ y: 2 }] } });
    expect(out.metrics).toEqual([]);
    expect(out.workouts).toEqual([]);
  });
  it("tolerates a batched subset (workouts absent)", () => {
    const out = parseHaePayload({ data: { metrics: [{ name: "weight_body_mass", units: "lb", data: [{ date: "2026-06-05 07:00:00 -0700", qty: 181.4 }] }] } });
    expect(out.workouts).toEqual([]);
  });
  it("rejects a payload missing data.metrics (throws / returns a typed error)", () => {
    expect(() => parseHaePayload({ data: {} })).toThrow();
    expect(() => parseHaePayload({})).toThrow();
  });
});
