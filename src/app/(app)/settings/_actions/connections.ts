"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_PROVIDER } from "@/lib/integrations/store";
import { syncCalendar } from "@/lib/sync/calendar";
import type { ActionResult } from "@/lib/action-result";

/**
 * Disconnect Google: deletes the integration row (removing the encrypted tokens
 * entirely) so status reverts to NOT CONNECTED. RLS-scoped + explicit user_id.
 */
export async function disconnectGoogle(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Run a calendar sync immediately. Used by the post-connect "Syncing…" trigger
 * so events show up on the dashboard right after the OAuth round-trip.
 */
export async function syncGoogleNow(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const result = await syncCalendar(supabase, userId);

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  if (!result.ok) return { ok: false, error: `Sync ${result.status}` };
  return { ok: true };
}
