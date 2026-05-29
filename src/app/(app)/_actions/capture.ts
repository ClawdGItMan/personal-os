"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

const Capture = z.object({
  text: z.string().min(1, "Nothing to capture").max(2000),
});

/**
 * Phase-1A capture: free text → a journal entry. No NLP routing yet (Phase 2 agent will
 * parse intent and fan out to the right module). For now, capture = journal.
 */
export async function capture(input: unknown): Promise<ActionResult> {
  const parsed = Capture.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .insert({ user_id: userId, text: parsed.data.text });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
