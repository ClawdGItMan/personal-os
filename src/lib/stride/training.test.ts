import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./demo";
import {
  addDays,
  dayKey,
  generateWeek,
  mergeRuns,
  monday,
  pace,
  readiness,
  runDay,
  suggestAdjustment,
  weekDistance,
} from "./training";
import { workspaceSchema } from "./schema";
import { localCoach } from "./coach";
import { runInsight } from "./insights";
import type { Run } from "./types";

const sample: Run = {
  id: "manual-1",
  title: "Morning run",
  date: "2026-09-05T07:00:00",
  distance: 10,
  duration: 3600,
  heartRate: 145,
  elevation: 20,
  effort: 4,
  pain: false,
  notes: "Comfortable",
  kind: "Easy run",
  source: "Manual",
};
afterEach(() => {
  vi.useRealTimers();
});
function clock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T12:00:00"));
}

describe("runner-centered planning", () => {
  it("produces the requested running frequency with separation between hard sessions", () => {
    clock();
    const state = initialState(false);
    for (const days of [3, 4, 5]) {
      const week = generateWeek({ ...state.profile, days });
      expect(week.filter((s) => s.distance > 0)).toHaveLength(days);
      expect(week[1]!.kind).toBe("Tempo run");
      expect(week[2]!.kind).toBe("Strength");
      expect(week[4]!.kind).toBe("Rest day");
    }
  });
  it("tapers mileage and includes race day exactly once", () => {
    clock();
    const state = initialState(false);
    state.profile.raceDate = "2026-09-27";
    const normal = generateWeek(state.profile, new Date("2026-08-31T12:00:00"));
    const taper = generateWeek(state.profile, new Date("2026-09-14T12:00:00"));
    expect(taper.reduce((sum, s) => sum + s.distance, 0)).toBeLessThan(
      normal.reduce((sum, s) => sum + s.distance, 0),
    );
    expect(
      generateWeek(state.profile, new Date("2026-09-21T12:00:00")).filter(
        (s) => s.kind === "Race day",
      ),
    ).toHaveLength(1);
    expect(
      generateWeek(state.profile, new Date("2026-09-28T12:00:00")).every(
        (s) => s.kind === "Rest day",
      ),
    ).toBe(true);
  });
  it("suggests a lighter future session after high effort, without mutating the plan", () => {
    clock();
    const state = initialState(false);
    state.runs = [{ ...sample, effort: 9 }];
    const result = suggestAdjustment(state, state.runs[0]);
    expect(result?.after.kind).toBe("Recovery run");
    expect(result?.sessionDate).toBe("2026-09-07");
    expect(state.overrides).toEqual({});
  });
  it("elevates a pending fatigue adjustment to rest when pain is reported", () => {
    clock();
    const state = initialState(false);
    state.runs = [{ ...sample, effort: 9 }];
    const fatigue = suggestAdjustment(state, state.runs[0])!;
    state.adjustments = [fatigue];
    const pain = suggestAdjustment(state, undefined, {
      date: dayKey(),
      energy: 4,
      soreness: 2,
      sleep: 8,
      pain: true,
    });
    expect(pain?.after.kind).toBe("Rest day");
    expect(pain?.sessionId).toBe(fatigue.sessionId);
  });
  it("does not keep issuing the same adjustment or increase load after one good run", () => {
    clock();
    const state = initialState(false);
    expect(suggestAdjustment(state, sample)).toBeNull();
    state.runs = [{ ...sample, effort: 9 }];
    state.adjustments = [suggestAdjustment(state, state.runs[0])!];
    expect(suggestAdjustment(state, state.runs[0])).toBeNull();
  });
  it("does not infer readiness without a check-in and prioritizes pain", () => {
    expect(readiness(undefined).score).toBeNull();
    expect(
      readiness({
        date: "2026-09-05",
        energy: 5,
        sleep: 9,
        soreness: 0,
        pain: true,
      }).label,
    ).toBe("Pause & assess");
  });
  it("keeps low-volume starters easy and caps long sessions", () => {
    clock();
    const state = initialState(false);
    expect(
      generateWeek({ ...state.profile, weeklyKm: 10 }).some(
        (s) => s.kind === "Tempo run",
      ),
    ).toBe(false);
    expect(
      generateWeek({ ...state.profile, weeklyKm: 150 }).every(
        (s) => s.distance <= 32,
      ),
    ).toBe(true);
  });
});

describe("activity integrity", () => {
  it("merges repeated imports and preserves personal reflection", () => {
    const existing = {
      ...sample,
      id: "strava-8",
      source: "Strava" as const,
      effort: 6,
      notes: "Felt strong",
    };
    const update = { ...existing, distance: 10.1, notes: "", effort: null };
    const result = mergeRuns([existing], [update, update]);
    expect(result).toHaveLength(1);
    expect(result[0]!.effort).toBe(6);
    expect(result[0]!.notes).toBe("Felt strong");
    expect(result[0]!.distance).toBe(10.1);
  });
  it("merges the same workout from Apple Health and Strava without merging separate runs", () => {
    const apple = { ...sample, id: "apple-1", source: "Apple Health" as const };
    const strava = {
      ...sample,
      id: "strava-1",
      source: "Strava" as const,
      distance: 10.03,
      duration: 3590,
    };
    expect(mergeRuns([apple], [strava])).toHaveLength(1);
    expect(
      mergeRuns([apple], [{ ...strava, date: "2026-09-05T18:00:00" }]),
    ).toHaveLength(2);
  });
  it("uses the device timezone consistently for week boundaries", () => {
    clock();
    const timestamp = new Date("2026-09-07T01:00:00Z");
    const run = { ...sample, date: timestamp.toISOString() };
    expect(runDay(run)).toBe(dayKey(timestamp));
    const start = monday(timestamp);
    expect(weekDistance([run], start)).toBe(10);
    expect(weekDistance([run], addDays(start, 7))).toBe(0);
  });
  it("formats paces correctly at minute rollovers and with missing distance", () => {
    expect(pace({ distance: 1, duration: 359.8 })).toBe("6:00");
    expect(pace({ distance: 0, duration: 0 })).toBe("—");
  });
  it("validates backups and rejects malformed or unbounded data", () => {
    clock();
    const state = initialState();
    expect(workspaceSchema.safeParse(state).success).toBe(true);
    expect(
      workspaceSchema.safeParse({
        ...state,
        runs: [{ ...sample, duration: -1 }],
      }).success,
    ).toBe(false);
    expect(
      workspaceSchema.safeParse({
        ...state,
        profile: { ...state.profile, days: 7 },
      }).success,
    ).toBe(false);
  });
  it("handles urgent symptoms without normal training guidance", () => {
    expect(localCoach("I have chest pain", initialState(false))).toContain(
      "urgent medical attention",
    );
  });
  it("compares similarly rated runs without claiming a fitness prediction", () => {
    const history = [1, 2].map((i) => ({
      ...sample,
      id: `older-${i}`,
      date: `2026-09-0${i}T07:00:00`,
      duration: 3700,
    }));
    const insight = runInsight(sample, history);
    expect(insight.body).toContain("10 sec/km quicker");
    expect(insight.body).toContain("not a fitness prediction");
    expect(runInsight({ ...sample, pain: true }, history).body).toContain(
      "clinician",
    );
  });
});
