import { addDays, dayKey, monday } from "./training";
import type { Run, StrideState } from "./types";

export function initialState(demo = true): StrideState {
  const today = new Date();
  const week = monday(today);
  const runs: Run[] = [];
  if (demo)
    for (let w = 4; w >= 0; w--)
      for (const [i, day] of [0, 1, 3, 5].entries()) {
        const date = addDays(week, day - w * 7);
        if (dayKey(date) >= dayKey(today)) continue;
        const distance = [7.5, 9, 7, 14][i]! - w * 0.45;
        runs.push({
          id: `demo-${w}-${day}`,
          date: `${dayKey(date)}T07:15:00`,
          title: [
            "Morning miles",
            "Finding a faster gear",
            "An easy loop",
            "The weekend long run",
          ][i]!,
          distance: Math.round(distance * 10) / 10,
          duration: Math.round(distance * [365, 322, 370, 374][i]!),
          heartRate: [139, 158, 136, 144][i]! + w,
          elevation: [31, 24, 18, 68][i]!,
          effort: [3, 6, 3, 5][i]!,
          pain: false,
          notes:
            i === 1
              ? "Felt controlled through the final effort."
              : "Comfortable effort. Legs felt good.",
          kind: i === 1 ? "Tempo run" : i === 3 ? "Long run" : "Easy run",
          source: "Demo",
        });
      }
  return {
    version: 1,
    demo,
    profile: {
      name: "Runner",
      raceName: "Autumn Marathon",
      raceDate: dayKey(addDays(today, 78)),
      goalTime: "3:45",
      weeklyKm: 42,
      days: 4,
    },
    runs: runs.reverse(),
    checkins: demo
      ? [{ date: dayKey(), energy: 4, soreness: 2, sleep: 7.8, pain: false }]
      : [],
    adjustments: [],
    overrides: {},
    strength: demo
      ? [dayKey(addDays(week, 2))].filter((d) => d < dayKey())
      : [],
    water: demo ? { [dayKey()]: 1250 } : {},
    meals: demo
      ? [
          {
            id: "demo-meal",
            date: dayKey(),
            name: "Oats, banana & Greek yogurt",
            carbs: 78,
            protein: 24,
          },
        ]
      : [],
    messages: [
      {
        id: "welcome",
        role: "assistant",
        mode: "local",
        content:
          "Hey, I’m your Stride coach. We’ll take this one session at a time. I can help you reflect on your runs, plan your fueling, and make room for recovery.\n\nBefore we get started: how are your legs feeling today, and what would make this training week a good one for you?",
      },
    ],
    cloudCoach: false,
    healthImportedAt: null,
  };
}
