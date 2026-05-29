"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const AddHabit = z.object({
  name: z.string().min(1, "Name required").max(100),
  sub_label: z.string().max(100).default(""),
});

const ToggleHabit = z.object({
  habitId: z.string().min(1),
  done: z.boolean(),
});

export async function addHabit(input: unknown): Promise<ActionResult> {
  const parsed = AddHabit.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .insert({ user_id: userId, name: parsed.data.name, sub_label: parsed.data.sub_label });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleHabitToday(input: unknown): Promise<ActionResult> {
  const parsed = ToggleHabit.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  // One log row per (habit_id, date); upsert flips today's done state.
  const { error } = await supabase
    .from("habit_logs")
    .upsert(
      { user_id: userId, habit_id: parsed.data.habitId, date: todayISO(), done: parsed.data.done },
      { onConflict: "habit_id,date" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
