import type {
  Adjustment,
  CheckIn,
  Profile,
  Run,
  Session,
  StrideState,
} from "./types";

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function runDay(run: Pick<Run, "date">): string {
  return dayKey(new Date(run.date));
}
export function parseDay(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
export function monday(date = new Date()): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.UTC(...dateParts(a)) - Date.UTC(...dateParts(b))) / 86400000,
  );
}
function dateParts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m! - 1, d!];
}
export function formatDay(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return parseDay(date).toLocaleDateString("en-US", options);
}
export function pace(run: Pick<Run, "distance" | "duration">): string {
  if (run.distance <= 0 || run.duration <= 0) return "—";
  const seconds = Math.round(run.duration / run.distance);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  return `${hours ? `${hours}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(hours ? 2 : 1, "0")}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
}
export function weekDistance(runs: Run[], start = monday()): number {
  const end = dayKey(addDays(start, 7));
  const begin = dayKey(start);
  return (
    Math.round(
      runs
        .filter((r) => runDay(r) >= begin && runDay(r) < end)
        .reduce((total, r) => total + r.distance, 0) * 10,
    ) / 10
  );
}
export function goalPace(profile: Profile): string {
  const [hours, minutes] = profile.goalTime.split(":").map(Number);
  return pace({
    distance: 42.195,
    duration: ((hours || 0) * 60 + (minutes || 0)) * 60,
  });
}
export function generateWeek(
  profile: Profile,
  weekStart = monday(),
  overrides: StrideState["overrides"] = {},
): Session[] {
  const weeksToRace = Math.max(
    0,
    daysBetween(profile.raceDate, dayKey(weekStart)) / 7,
  );
  const taper =
    weeksToRace < 1
      ? 0.35
      : weeksToRace < 2
        ? 0.55
        : weeksToRace < 3
          ? 0.75
          : 1;
  const recoveryWeek = Math.floor(weeksToRace) % 4 === 0 && weeksToRace > 3;
  const weekly = profile.weeklyKm * taper * (recoveryWeek ? 0.85 : 1);
  const runDays =
    profile.days === 3
      ? [1, 3, 5]
      : profile.days === 5
        ? [0, 1, 3, 5, 6]
        : [0, 1, 3, 5];
  const shares =
    profile.days === 3
      ? [0.3, 0.3, 0.4]
      : profile.days === 5
        ? [0.18, 0.22, 0.16, 0.34, 0.1]
        : [0.2, 0.24, 0.2, 0.36];
  return Array.from({ length: 7 }, (_, index) => {
    const date = dayKey(addDays(weekStart, index));
    const id = `session-${date}`;
    const rest: Session = {
      id,
      date,
      kind: "Rest day",
      title: "Room to recover",
      distance: 0,
      minutes: 0,
      description:
        "Rest, eat well, and make room for sleep. An optional gentle walk is enough today.",
    };
    if (date > profile.raceDate) return rest;
    if (date === profile.raceDate)
      return {
        ...rest,
        kind: "Race day",
        title: profile.raceName,
        distance: 42.195,
        description:
          "Your starting line. Follow your practiced pacing and fueling strategy.",
      };
    let session = rest;
    if (index === 2 && weeksToRace > 1)
      session = {
        ...rest,
        kind: "Strength",
        title: "Build your foundation",
        minutes: 25,
        description:
          "A controlled strength session: squats, calf raises, glute bridges, and side planks. Use comfortable loads and pain-free movement.",
      };
    const runIndex = runDays.indexOf(index);
    if (runIndex >= 0 && daysBetween(profile.raceDate, date) > 1) {
      const long = index === 5;
      const tempo = index === 1 && weeksToRace > 2 && profile.weeklyKm >= 25;
      const distance = Math.min(
        long ? 32 : 25,
        Math.round(weekly * shares[runIndex]! * 2) / 2,
      );
      const kind = long
        ? "Long run"
        : tempo
          ? "Tempo run"
          : index === 6
            ? "Recovery run"
            : "Easy run";
      session = {
        id,
        date,
        kind,
        distance,
        title: long
          ? "Find your long-run rhythm"
          : tempo
            ? "A little comfortably hard"
            : "Easy miles, steady progress",
        minutes: Math.round(distance * (tempo ? 5.7 : 6.4)),
        description: long
          ? "Keep a conversational effort. Start gently, take planned fuel, and finish with enough left in the tank."
          : tempo
            ? "Start with 10 minutes easy, then 3 × 6 minutes at a controlled, comfortably hard effort with 2-minute easy recoveries. Cool down easily; fit the whole session within the planned distance."
            : "Run at an effort where you can speak in full sentences. Let your breathing guide your pace.",
      };
    }
    return overrides[id] ? { ...session, ...overrides[id] } : session;
  });
}
export function readiness(checkin: CheckIn | undefined): {
  score: number | null;
  label: string;
  detail: string;
} {
  if (!checkin)
    return {
      score: null,
      label: "Let’s check in",
      detail: "Tell us how you feel before your next session.",
    };
  if (checkin.pain)
    return {
      score: 25,
      label: "Pause & assess",
      detail:
        "Pain deserves attention. Skip running and consider a sports clinician.",
    };
  const score = Math.round(
    Math.min(
      100,
      Math.max(
        15,
        checkin.energy * 10 +
          Math.min(checkin.sleep, 8) * 6 -
          checkin.soreness * 4,
      ),
    ),
  );
  return {
    score,
    label:
      score >= 75
        ? "Feeling ready"
        : score >= 50
          ? "Keep it gentle"
          : "Recovery comes first",
    detail: "An estimate from your check-in, not a medical assessment.",
  };
}
export function suggestAdjustment(
  state: StrideState,
  run?: Run,
  checkin?: CheckIn,
): Adjustment | null {
  const today = dayKey();
  const sessions = [0, 7, 14].flatMap((offset) =>
    generateWeek(state.profile, addDays(monday(), offset), state.overrides),
  );
  const pain = run?.pain || checkin?.pain;
  const next = sessions.find(
    (s) =>
      s.date >= today &&
      s.distance > 0 &&
      s.kind !== "Race day" &&
      !state.runs.some((r) => runDay(r) === s.date),
  );
  if (!next) return null;
  const pending = state.adjustments.find(
    (a) => a.status === "pending" && a.sessionId === next.id,
  );
  if (pending && (!pain || pending.after.kind === "Rest day")) return null;
  const fatigued =
    (run?.effort ?? 0) >= 8 ||
    (checkin &&
      (checkin.sleep < 6 || checkin.soreness >= 6 || checkin.energy <= 2));
  const weekKm = weekDistance(state.runs);
  const overloaded = weekKm > state.profile.weeklyKm * 1.15;
  if (!pain && !fatigued && !overloaded) return null;
  const after: Adjustment["after"] = pain
    ? {
        kind: "Rest day",
        title: "Pause for recovery",
        distance: 0,
        minutes: 0,
        description:
          "Skip this run. If pain persists, worsens, or changes your stride, consult a qualified sports clinician before resuming.",
      }
    : {
        kind: "Recovery run",
        title: "Keep it easy",
        distance: Math.round(next.distance * 0.75 * 2) / 2,
        minutes: Math.round(next.minutes * 0.75),
        description:
          "An optional shorter, conversational run. Choose rest instead if you still feel fatigued or develop pain.",
      };
  return {
    id: `adjust-${Date.now()}`,
    date: today,
    title: pain
      ? "Give your body some room"
      : "A little recovery goes a long way",
    reason: pain
      ? "You reported pain. The next run should wait while you assess how you feel."
      : overloaded
        ? `You have logged ${weekKm} km against your ${state.profile.weeklyKm} km weekly baseline. Let’s ease the next session.`
        : `Your ${run ? `last run felt ${run.effort}/10` : "check-in suggests some fatigue"}. A lighter next session gives you space to recover.`,
    sessionId: next.id,
    sessionDate: next.date,
    before: `${next.distance} km ${next.kind.toLowerCase()}`,
    after,
    status: "pending",
  };
}
export function mergeRuns(existing: Run[], incoming: Run[]): Run[] {
  const result = [...existing];
  for (const run of incoming) {
    const duplicate = result.findIndex(
      (r) =>
        r.id === run.id ||
        (r.source !== run.source &&
          r.source !== "Demo" &&
          runDay(r) === runDay(run) &&
          Math.abs(new Date(r.date).getTime() - new Date(run.date).getTime()) <
            180000 &&
          Math.abs(r.distance - run.distance) < 0.2 &&
          Math.abs(r.duration - run.duration) < 180),
    );
    if (duplicate < 0) result.push(run);
    else if (result[duplicate]!.source === run.source)
      result[duplicate] = {
        ...run,
        effort: result[duplicate]!.effort ?? run.effort,
        pain: result[duplicate]!.pain,
        notes: result[duplicate]!.notes || run.notes,
      };
  }
  return result.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
