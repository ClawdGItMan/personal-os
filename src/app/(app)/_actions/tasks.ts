"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

const AddTask = z.object({
  title: z.string().min(1, "Title required").max(200),
  star: z.boolean().default(false),
});

const ToggleTask = z.object({
  id: z.string().min(1),
  done: z.boolean(),
});

export async function addTask(input: unknown): Promise<ActionResult> {
  const parsed = AddTask.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, title: parsed.data.title, star: parsed.data.star });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleTask(input: unknown): Promise<ActionResult> {
  const parsed = ToggleTask.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ done: parsed.data.done })
    .eq("id", parsed.data.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
