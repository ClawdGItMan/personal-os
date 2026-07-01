/**
 * Sample Body data — same content as the approved body-v2 mockup (spec §5.2).
 * Replaced by Whoop / HealthKit / Strava sync when the data layer lands.
 */

export type SleepStage = {
  label: string;
  /** Fraction of total sleep, 0–1 — drives both the stacked bar and legend. */
  fraction: number;
  /** Readable duration (e.g. "1h36"). */
  duration: string;
  /** Token color key for this stage segment. */
  tone: "green" | "blue" | "light" | "awake";
};

export type Macro = {
  label: string;
  grams: string;
  /** 0–1 fill of the target bar. */
  pct: number;
  tone: "green" | "blue" | "yellow";
};

/**
 * Live body metrics (Whoop `health_snapshots`). Any field may be null when that
 * day's sync didn't cover it — `applyLiveBody` leaves the mock in place for nulls.
 */
export type LiveBody = {
  recoveryScore: number | null;
  hrv: number | null;
  rhr: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  strain: number | null;
};

/**
 * Mutable at runtime so a live sync can override the mock in place (the Body
 * sections read `bodyData.*` inside their render bodies — see `applyLiveBody`).
 * Sleep STAGES, SpO₂, training lifts + PR count, and nutrition stay mock: no
 * columns for them yet. `as const` is intentionally dropped so fields are writable.
 */
export const bodyData = {
  eyebrow: "Body · Friday, May 8",
  title: { lead: "Well ", emphasis: "recovered." },
  recoveryPct: 0.72,
  recovery: {
    pct: 72,
    source: "WHOOP · 6:42 AM",
    stats: [
      { label: "HRV", value: "64", unit: "ms" },
      { label: "Resting HR", value: "48", unit: "bpm" },
      { label: "SpO₂", value: "97", unit: "%" },
    ],
    readout: "Green to push — your body's ready for strain today.",
  },
  sleep: {
    meta: "7H12 / 8H00 NEED",
    hours: "7",
    minutes: "12",
    quality: "87%",
    stages: [
      { label: "Deep", fraction: 0.22, duration: "1h36", tone: "green" },
      { label: "REM", fraction: 0.24, duration: "1h44", tone: "blue" },
      { label: "Light", fraction: 0.46, duration: "3h20", tone: "light" },
      { label: "Awake", fraction: 0.08, duration: "0h32", tone: "awake" },
    ] satisfies SleepStage[],
  },
  strain: {
    meta: "DAY · TARGET 18",
    value: "14.2",
    state: "BUILDING",
    pct: 0.79,
    /** 7-day relative heights, 0–1; `peak` marks the yellow bar. */
    week: [
      { height: 0.4 },
      { height: 0.55 },
      { height: 0.35 },
      { height: 0.7 },
      { height: 0.48 },
      { height: 0.88, peak: true },
      { height: 0.62 },
    ],
  },
  training: {
    meta: "PUSH DAY · 11:00",
    prCount: "4",
    sessionTag: "SESSION ✓",
    lifts: [
      { name: "Bench Press", scheme: "3 × 5", weight: "185", pr: true },
      { name: "Incline DB Press", scheme: "3 × 8", weight: "70", pr: false },
      { name: "Overhead Press", scheme: "5 × 5", weight: "115", pr: true },
    ],
  },
  nutrition: {
    meta: "1,840 / 2,400 KCAL",
    /** 0–1 of the calorie target — fills the ring sweep. */
    kcalPct: 0.77,
    kcalLabel: "77",
    macros: [
      { label: "Protein", grams: "142g", pct: 0.78, tone: "green" },
      { label: "Carbs", grams: "180g", pct: 0.6, tone: "blue" },
      { label: "Fat", grams: "56g", pct: 0.48, tone: "yellow" },
    ] satisfies Macro[],
  },
};

/** Whoop recovery band → the serif read-out under the ring (spec §5.2 voice). */
function recoveryReadout(pct: number): string {
  if (pct >= 67) return "Green to push — your body's ready for strain today.";
  if (pct >= 34) return "Amber — build steady, keep the intensity honest.";
  return "Red — prioritise recovery; go light and rebuild.";
}

/** Split decimal hours (7.2) into whole hours + zero-padded minutes ("7", "12"). */
function splitHours(decimalHours: number): { hours: string; minutes: string } {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

/**
 * Merge live Whoop values over the mock in place. Idempotent and null-safe:
 * called each render, it re-derives every live field from `live` and leaves the
 * mock untouched wherever `live.*` is null. Keeps the Body sections' APIs intact.
 */
export function applyLiveBody(live: LiveBody): void {
  const { recoveryScore, hrv, rhr, sleepHours, sleepScore, strain } = live;

  if (recoveryScore != null) {
    const pct = Math.round(recoveryScore);
    bodyData.recovery.pct = pct;
    bodyData.recoveryPct = recoveryScore / 100;
    bodyData.recovery.readout = recoveryReadout(pct);
  }
  if (hrv != null) bodyData.recovery.stats[0].value = String(Math.round(hrv));
  if (rhr != null) bodyData.recovery.stats[1].value = String(Math.round(rhr));

  if (sleepHours != null) {
    const { hours, minutes } = splitHours(sleepHours);
    bodyData.sleep.hours = hours;
    bodyData.sleep.minutes = minutes;
    bodyData.sleep.meta = `${hours}H${minutes} / 8H00 NEED`;
  }
  if (sleepScore != null) bodyData.sleep.quality = `${Math.round(sleepScore)}%`;

  if (strain != null) bodyData.strain.value = strain.toFixed(1);
}
