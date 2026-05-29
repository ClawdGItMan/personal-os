"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const LogFollowers = z.object({
  platform: z.enum(["X", "LINKEDIN", "SUBSTACK", "GITHUB", "IG"]),
  count: z.number().int().min(0).max(1_000_000_000),
});

export async function logFollowers(input: unknown): Promise<ActionResult> {
  const parsed = LogFollowers.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.from("social_followers").upsert(
    { user_id: userId, platform: parsed.data.platform, date: todayISO(), count: parsed.data.count, source: "manual" },
    { onConflict: "user_id,platform,date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
