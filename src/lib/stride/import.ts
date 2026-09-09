import type { Run } from "./types";

function km(value: string | null, unit: string | null): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (unit === "mi") return number * 1.609344;
  if (unit === "m") return number / 1000;
  return unit === "km" ? number : 0;
}
export function parseHealthExport(xml: string): Run[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error(
      "This XML file could not be read. Choose the export.xml file from your Apple Health export.",
    );
  const runs: Run[] = [];
  for (const workout of Array.from(document.querySelectorAll("Workout"))) {
    if (
      workout.getAttribute("workoutActivityType") !==
      "HKWorkoutActivityTypeRunning"
    )
      continue;
    const start = workout.getAttribute("startDate") ?? "";
    const date = new Date(
      start.replace(
        /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/,
        "$1T$2$3:$4",
      ),
    );
    if (!Number.isFinite(date.getTime())) continue;
    const stats = Array.from(workout.querySelectorAll("WorkoutStatistics"));
    const distanceStat = stats.find(
      (s) =>
        s.getAttribute("type") ===
        "HKQuantityTypeIdentifierDistanceWalkingRunning",
    );
    const distance = distanceStat
      ? km(distanceStat.getAttribute("sum"), distanceStat.getAttribute("unit"))
      : km(
          workout.getAttribute("totalDistance"),
          workout.getAttribute("totalDistanceUnit"),
        );
    const rawDuration = Number(workout.getAttribute("duration"));
    const unit = workout.getAttribute("durationUnit");
    const seconds =
      rawDuration *
      (unit === "min" ? 60 : unit === "hr" ? 3600 : unit === "s" ? 1 : 0);
    if (
      distance <= 0 ||
      distance > 500 ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    )
      continue;
    const hr = Number(
      stats
        .find(
          (s) => s.getAttribute("type") === "HKQuantityTypeIdentifierHeartRate",
        )
        ?.getAttribute("average"),
    );
    runs.push({
      id: `apple-${date.toISOString()}-${Math.round(seconds)}`,
      title: "Apple Health run",
      date: date.toISOString(),
      distance: Math.round(distance * 100) / 100,
      duration: Math.round(seconds),
      heartRate: hr > 0 ? Math.round(hr) : null,
      elevation: 0,
      effort: null,
      pain: false,
      notes: "",
      kind: "Easy run",
      source: "Apple Health",
    });
  }
  if (!runs.length)
    throw new Error(
      "No running workouts with distance and duration were found in this export.",
    );
  return runs;
}
