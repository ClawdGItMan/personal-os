"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

const StartSession = z.object({
  split_name: z.string().min(1, "Name the session").max(60),
});

const LogLift = z.object({
  session_id: z.string().min(1),
  name: z.string().min(1, "Exercise name required").max(80),
  weight: z.number().min(0).max(2000),
  weight_unit: z.enum(["lbs", "kg"]).default("lbs"),
  reps: z.number().int().min(0).max(1000),
  sets: z.number().int().min(1).max(100).default(1),
});

export async function startSession(input: unknown): Promise<ActionResult> {
  const parsed = StartSession.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sessions")
    .insert({ user_id: userId, split_name: parsed.data.split_name });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function logLift(input: unknown): Promise<ActionResult> {
  const parsed = LogLift.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();

  // PR detection: compare to the heaviest prior lift of the same name (RLS scopes to user).
  const { data: prior } = await supabase
    .from("lifts")
    .select("weight")
    .eq("name", parsed.data.name)
    .order("weight", { ascending: false })
    .limit(1);
  const priorMax = prior?.[0]?.weight ?? 0;
  const isPr = parsed.data.weight > Number(priorMax) && parsed.data.weight > 0;

  const { error } = await supabase.from("lifts").insert({
    user_id: userId,
    session_id: parsed.data.session_id,
    name: parsed.data.name,
    weight: parsed.data.weight,
    weight_unit: parsed.data.weight_unit,
    reps: parsed.data.reps,
    sets: parsed.data.sets,
    is_pr: isPr,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
