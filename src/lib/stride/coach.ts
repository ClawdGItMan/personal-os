import { goalPace, pace, weekDistance } from "./training";
import type { StrideState } from "./types";

export function localCoach(message: string, state: StrideState): string {
  const text = message.toLowerCase();
  const last = state.runs[0];
  if (
    /chest pain|faint|passing out|trouble breathing|cannot breathe/.test(text)
  )
    return "Stop exercising. Chest pain, fainting, or unusual breathing difficulty can need urgent medical attention. Seek urgent help now; contact your local emergency service if symptoms are severe or ongoing.";
  if (/pain|injur|hurt|shin|knee|achilles/.test(text))
    return "Let’s take that seriously. Skip speed work and avoid running through pain, especially if it is sharp, worsening, or changing your stride. Persistent symptoms are worth discussing with a sports clinician; I can’t assess an injury from chat.\n\nWhere do you feel it, when did it start, and does it affect walking? You can also record a check-in so we can suggest a recovery change to your plan.";
  if (/fuel|eat|food|carb|nutrition|gel|breakfast/.test(text))
    return "Practice fueling on your long runs with foods you already tolerate. For a run lasting roughly 1–2.5 hours, a common starting range is 30–60 g of carbohydrate per hour. Work toward it gradually and adjust with a sports dietitian if needed. Hydration needs vary with heat, sweat, and your body.\n\nUse Nutrition to make a simple fuel schedule. How long is your next run, and have gels or sports drinks been comfortable for your stomach before?";
  if (/tired|fatigue|sleep|sore|recover|heavy/.test(text))
    return "A lighter day can be a useful training decision. If you are tired or unusually sore, trade intensity for an easy session or rest and prioritize enough food and sleep. You don’t need to make up missed miles.\n\nLog today’s energy, sleep, soreness, and any pain in your check-in; I’ll use those to suggest a specific change. Is this general tiredness, or discomfort in one spot?";
  if (/pace|speed|tempo|interval|fast/.test(text))
    return `Your goal time corresponds to about ${goalPace(state.profile)}/km, but a goal alone doesn’t establish a safe training pace. ${last ? `Your latest logged run averaged ${pace(last)}/km${last.effort ? ` at ${last.effort}/10 effort` : ""}.` : "Log a recent run so we have a starting point."}\n\nKeep easy runs conversational and harder work controlled, with recovery between efforts. What was your recent 5K or 10K result, and how did that effort feel?`;
  if (/strength|strong|exercise|gym/.test(text))
    return "A simple, consistent strength routine can complement your running: a squat pattern, a hip hinge or glute bridge, calf raises, and a side plank. Start with a comfortable load, use controlled movement, and stop any exercise that causes pain.\n\nThe Strength & recovery page has a short session you can track. Do you have access to weights, or would a bodyweight routine fit better?";
  if (/plan|progress|week|run|marathon/.test(text))
    return `You have logged ${weekDistance(state.runs)} km this week against a ${state.profile.weeklyKm} km baseline. ${last ? `Your most recent run was ${last.distance.toFixed(1)} km${last.effort ? ` at an effort of ${last.effort}/10` : ""}.` : "Your first logged run will help personalize this picture."} One session doesn’t tell the whole story, so we’ll look for consistent patterns before making bigger changes.\n\nAfter each run, log how hard it felt and any pain. Stride can suggest a lighter upcoming session when effort, soreness, or workload is high. What part of your plan feels most challenging right now?`;
  return "Let’s work through that together. I can help with your training week, pace and speed sessions, long-run fueling, strength, and recovery. This local preview uses a small set of coaching rules; open-ended AI conversations require live AI to be configured.\n\nWhat feels most useful right now: reviewing your latest run, planning your next one, or talking through how your body feels?";
}
