import type { Run } from "./types";
import { pace } from "./training";

export function runInsight(run: Run, history: Run[]) {
  if (run.pain)
    return {
      title: "Your body gets the deciding vote.",
      body: "You reported pain during this run. Pause activities that bring it on and review your next session. Persistent, worsening, or gait-changing pain needs a qualified clinician’s assessment.",
      question: "Where did it hurt, and how does it feel when you walk?",
    };
  if ((run.effort ?? 0) >= 8)
    return {
      title: "That was a demanding session.",
      body: `You rated this run ${run.effort}/10. Make room for recovery before another hard effort. Check Training plan for a proposed lighter session.`,
      question: "Was the effort expected, or did this feel harder than usual?",
    };
  const comparable = history
    .filter(
      (previous) =>
        previous.id !== run.id &&
        previous.kind === run.kind &&
        (previous.source === "Demo") === (run.source === "Demo") &&
        new Date(previous.date) < new Date(run.date) &&
        new Date(run.date).getTime() - new Date(previous.date).getTime() <
          28 * 86400000 &&
        previous.distance >= run.distance * 0.65 &&
        previous.distance <= run.distance * 1.5 &&
        previous.effort !== null &&
        run.effort !== null &&
        Math.abs(previous.effort - run.effort) <= 1,
    )
    .slice(0, 5);
  if (comparable.length >= 2) {
    const baseline =
      comparable.reduce((sum, r) => sum + r.duration / r.distance, 0) /
      comparable.length;
    const difference = Math.round(baseline - run.duration / run.distance);
    return {
      title:
        Math.abs(difference) < 8
          ? "A steady rhythm is taking shape."
          : difference > 0
            ? "A quicker pace at a similar reported effort."
            : "A slower pace can still be useful work.",
      body: `Your ${pace(run)}/km average is ${Math.abs(difference) < 8 ? "close to" : `${Math.abs(difference)} sec/km ${difference > 0 ? "quicker" : "slower"} than`} your ${comparable.length} recent ${run.kind.toLowerCase()}s at a similar reported effort. Route, weather, and recovery can explain changes; this is a comparison, not a fitness prediction.`,
      question: "Were the terrain and conditions similar to your usual runs?",
    };
  }
  return {
    title:
      run.effort === null
        ? "There’s more to the story than pace."
        : "Another useful piece of your training story.",
    body: `You logged ${run.distance.toFixed(1)} km at ${pace(run)}/km${run.effort ? ` with a reported effort of ${run.effort}/10` : ""}. A few more runs with effort ratings will make like-for-like comparisons more useful.`,
    question: "How did your energy and breathing change toward the end?",
  };
}
