import { z } from "zod";
import type { StrideState } from "./types";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid date");
const runKind = z.enum([
  "Easy run",
  "Tempo run",
  "Intervals",
  "Long run",
  "Recovery run",
]);
const run = z.object({
  id: z.string().max(200),
  title: z.string().max(200),
  date: z
    .string()
    .max(50)
    .refine((value) => Number.isFinite(new Date(value).getTime())),
  distance: z.number().positive().max(500),
  duration: z.number().positive().max(200000),
  heartRate: z.number().min(20).max(250).nullable(),
  elevation: z.number().min(0).max(30000),
  effort: z.number().min(1).max(10).nullable(),
  pain: z.boolean(),
  notes: z.string().max(5000),
  kind: runKind,
  source: z.enum(["Manual", "Strava", "Apple Health", "Demo"]),
});
const after = z.object({
  kind: z.enum([
    "Easy run",
    "Tempo run",
    "Intervals",
    "Long run",
    "Recovery run",
    "Strength",
    "Rest day",
    "Race day",
  ]),
  title: z.string().max(200),
  distance: z.number().min(0).max(200),
  description: z.string().max(3000),
  minutes: z.number().min(0).max(1800),
});
export const workspaceSchema: z.ZodType<StrideState> = z.object({
  version: z.literal(1),
  demo: z.boolean(),
  profile: z.object({
    name: z.string().max(50),
    raceName: z.string().min(1).max(100),
    raceDate: date,
    goalTime: z.string().regex(/^[2-9]:[0-5]\d$/),
    weeklyKm: z.number().min(5).max(150),
    days: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  }),
  runs: z.array(run).max(50000),
  checkins: z.array(
    z.object({
      date,
      energy: z.number().min(1).max(5),
      soreness: z.number().min(0).max(10),
      sleep: z.number().min(0).max(16),
      pain: z.boolean(),
    }),
  ),
  adjustments: z.array(
    z.object({
      id: z.string(),
      date,
      title: z.string(),
      reason: z.string(),
      sessionId: z.string(),
      sessionDate: date,
      before: z.string(),
      after,
      status: z.enum(["pending", "accepted", "dismissed"]),
    }),
  ),
  overrides: z.record(z.string(), after),
  strength: z.array(date),
  water: z.record(z.string(), z.number().min(0).max(10000)),
  meals: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(100),
      carbs: z.number().min(0).max(500),
      protein: z.number().min(0).max(300),
      date,
    }),
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10000),
      mode: z.enum(["local", "ai"]).optional(),
    }),
  ),
  cloudCoach: z.boolean(),
  healthImportedAt: z.string().nullable(),
});
