"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const LogWeight = z.object({
  weight: z.number().min(20).max(1500),
  weight_unit: z.enum(["lbs", "kg"]).default("lbs"),
});

export async function logWeight(input: unknown): Promise<ActionResult> {
  const parsed = LogWeight.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  // One snapshot per (user, date); upsert sets only weight fields, leaving integration
  // metrics (sleep/hrv/etc.) untouched if a row already exists for today.
  const { error } = await supabase.from("health_snapshots").upsert(
    {
      user_id: userId,
      date: todayISO(),
      weight: parsed.data.weight,
      weight_unit: parsed.data.weight_unit,
      source: "manual",
    },
    { onConflict: "user_id,date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
