"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { initialsFrom } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const UpdateProfile = z.object({
  name: z.string().min(1, "Name required").max(80),
  role: z.string().max(80),
  location: z.string().max(80),
  focus: z.string().max(160),
});

/**
 * Single write path for the operator profile. `profiles` keys on `id` (= auth user id),
 * matching getOperator's `.eq("id", user.id)`; RLS scopes the row to the current user.
 */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = UpdateProfile.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name: parsed.data.name,
      initials: initialsFrom(parsed.data.name),
      role: parsed.data.role,
      location: parsed.data.location,
      focus: parsed.data.focus,
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  // The operator avatar/OperatorCard is mounted in the shell on every (app) route —
  // revalidate the whole layout so initials/name refresh app-wide.
  revalidatePath("/", "layout");
  return { ok: true };
}
