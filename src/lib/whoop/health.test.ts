import { describe, it, expect } from "vitest";
import { mapHealthDay, whoopDayDate, assembleHealthDays } from "./health";

describe("mapHealthDay", () => {
  it("maps + rounds to column precision and tags source", () => {
    const row = mapHealthDay({
      date: "2026-06-05",
      recoveryScore: 66.7,
      dayStrain: 12.34,
      sleepPerformance: 88.6,
      sleepHours: 7.48,
      hrv: 89.3,
      rhr: 54.6,
    });
    expect(row).toMatchObject({
      date: "2026-06-05",
      source: "whoop",
      recovery_score: 67,
      strain: 12.3,
      sleep_score: 89,
      sleep_hours: 7.5,
      hrv: 89,
      rhr: 55,
    });
  });

  it("omits fields that are absent (so the partial upsert won't null them)", () => {
    const row = mapHealthDay({ date: "2026-06-05", recoveryScore: 50 });
    expect(row.recovery_score).toBe(50);
    expect("strain" in row).toBe(false);
    expect("sleep_hours" in row).toBe(false);
  });
});

describe("whoopDayDate", () => {
  // America/New_York is UTC-4 in June (EDT). Both directions must hold so the
  // test proves a real tz conversion, not an accidental UTC date slice.
  it("assigns 01:30 local (post-midnight) to the day it ends", () => {
    // 2026-06-05T05:30:00Z === 2026-06-05 01:30 local (EDT). Day it ends = Jun 5.
    expect(whoopDayDate("2026-06-05T05:30:00Z", "America/New_York")).toBe(
      "2026-06-05",
    );
  });

  it("assigns 23:00 local (pre-midnight) to the local day, not the UTC day", () => {
    // 2026-06-05T03:00:00Z === 2026-06-04 23:00 local (EDT). UTC date would
    // wrongly say Jun 5; the local tz must say Jun 4.
    expect(whoopDayDate("2026-06-05T03:00:00Z", "America/New_York")).toBe(
      "2026-06-04",
    );
  });

  it("falls back to UTC when the timezone is invalid", () => {
    expect(whoopDayDate("2026-06-05T03:00:00Z", "Not/AZone")).toBe(
      "2026-06-05",
    );
  });
});

describe("assembleHealthDays", () => {
  const timeZone = "America/New_York";

  it("joins recovery↔cycle↔sleep for one day into a normalized object", () => {
    const days = assembleHealthDays(
      {
        cycles: [
          {
            id: 1001,
            start: "2026-06-05T09:00:00Z",
            score_state: "SCORED",
            score: { strain: 12.34 },
          },
        ],
        recoveries: [
          {
            cycle_id: 1001,
            sleep_id: "sleep-uuid-1",
            score_state: "SCORED",
            score: {
              recovery_score: 66.7,
              hrv_rmssd_milli: 89.3,
              resting_heart_rate: 54.6,
            },
          },
        ],
        sleeps: [
          {
            id: "sleep-uuid-1",
            nap: false,
            score_state: "SCORED",
            score: {
              sleep_performance_percentage: 88.6,
              stage_summary: {
                total_light_sleep_time_milli: 14_400_000, // 4h
                total_slow_wave_sleep_time_milli: 5_400_000, // 1.5h
                total_rem_sleep_time_milli: 7_128_000, // 1.98h => total 7.48h
              },
            },
          },
        ],
      },
      timeZone,
    );

    expect(days).toHaveLength(1);
    expect(days[0]).toEqual({
      date: "2026-06-05",
      dayStrain: 12.34,
      recoveryScore: 66.7,
      hrv: 89.3,
      rhr: 54.6,
      sleepPerformance: 88.6,
      sleepHours: 7.48,
    });
  });

  it("omits fields whose source record is not SCORED", () => {
    const days = assembleHealthDays(
      {
        cycles: [
          {
            id: 2002,
            start: "2026-06-05T09:00:00Z",
            score_state: "PENDING_SCORE",
            score: { strain: 9.9 },
          },
        ],
        recoveries: [
          {
            cycle_id: 2002,
            sleep_id: "sleep-uuid-2",
            score_state: "PENDING_SCORE",
            score: { recovery_score: 70, hrv_rmssd_milli: 80, resting_heart_rate: 50 },
          },
        ],
        sleeps: [
          {
            id: "sleep-uuid-2",
            nap: false,
            score_state: "SCORED",
            score: {
              sleep_performance_percentage: 90,
              stage_summary: {
                total_light_sleep_time_milli: 3_600_000,
                total_slow_wave_sleep_time_milli: 3_600_000,
                total_rem_sleep_time_milli: 3_600_000,
              },
            },
          },
        ],
      },
      timeZone,
    );

    expect(days).toHaveLength(1);
    const day = days[0];
    if (!day) throw new Error("expected one assembled day");
    // Cycle PENDING => strain omitted; recovery PENDING => recovery fields omitted.
    expect("dayStrain" in day).toBe(false);
    expect("recoveryScore" in day).toBe(false);
    expect("hrv" in day).toBe(false);
    expect("rhr" in day).toBe(false);
    // Sleep SCORED => sleep fields present.
    expect(day.sleepPerformance).toBe(90);
    expect(day.sleepHours).toBe(3);
    expect(day.date).toBe("2026-06-05");
  });

  it("excludes naps when joining the night's sleep", () => {
    const days = assembleHealthDays(
      {
        cycles: [
          {
            id: 3003,
            start: "2026-06-05T09:00:00Z",
            score_state: "SCORED",
            score: { strain: 5 },
          },
        ],
        recoveries: [
          {
            cycle_id: 3003,
            sleep_id: "nap-uuid",
            score_state: "SCORED",
            score: { recovery_score: 60, hrv_rmssd_milli: 70, resting_heart_rate: 55 },
          },
        ],
        sleeps: [
          {
            id: "nap-uuid",
            nap: true,
            score_state: "SCORED",
            score: {
              sleep_performance_percentage: 99,
              stage_summary: {
                total_light_sleep_time_milli: 1_800_000,
                total_slow_wave_sleep_time_milli: 0,
                total_rem_sleep_time_milli: 0,
              },
            },
          },
        ],
      },
      timeZone,
    );

    expect(days).toHaveLength(1);
    const day = days[0];
    if (!day) throw new Error("expected one assembled day");
    // The linked sleep is a nap => sleep metrics must be omitted.
    expect("sleepPerformance" in day).toBe(false);
    expect("sleepHours" in day).toBe(false);
    // Non-sleep fields still present.
    expect(day.dayStrain).toBe(5);
    expect(day.recoveryScore).toBe(60);
  });
});
