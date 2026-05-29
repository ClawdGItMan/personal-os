"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

const LogMeal = z.object({
  description: z.string().min(1, "Describe the meal").max(200),
  kcal: z.number().int().min(0).max(20000),
  protein_g: z.number().min(0).max(2000).default(0),
  carbs_g: z.number().min(0).max(2000).default(0),
  fat_g: z.number().min(0).max(2000).default(0),
});

export async function logMeal(input: unknown): Promise<ActionResult> {
  const parsed = LogMeal.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_entries").insert({
    user_id: userId,
    description: parsed.data.description,
    kcal: parsed.data.kcal,
    protein_g: parsed.data.protein_g,
    carbs_g: parsed.data.carbs_g,
    fat_g: parsed.data.fat_g,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
