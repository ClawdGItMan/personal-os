"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_PROVIDER } from "@/lib/integrations/store";
import { syncCalendar } from "@/lib/sync/calendar";
import { syncWhoop } from "@/lib/sync/whoop";
import { syncStrava } from "@/lib/sync/strava";
import { syncX } from "@/lib/sync/x";
import { mintIngestToken } from "@/lib/apple-health/ingest-token";
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

/**
 * Disconnect Whoop: deletes the integration row (removing the encrypted tokens
 * entirely) so status reverts to NOT CONNECTED. RLS-scoped + explicit user_id.
 */
export async function disconnectWhoop(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "whoop");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Generate (or rotate) the Apple Health ingest token. Upserts the integrations
 * row with ONLY the secret hash — the plaintext token is returned once and never
 * persisted. Rotating overwrites the stored hash so the old token instantly 401s.
 */
export async function regenerateAppleHealthToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const { token, secretHash } = mintIngestToken(userId);

  const supabase = await createClient();
  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "apple_health",
      status: "connected",
      last_error: null,
      metadata: {
        token_hash: secretHash,
        token_created_at: new Date().toISOString(),
      },
    },
    { onConflict: "user_id,provider" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, token };
}

/**
 * Disconnect Apple Health: deletes the integration row (removing the stored
 * token hash) so status reverts to NOT CONNECTED.
 */
export async function disconnectAppleHealth(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "apple_health");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/train");
  return { ok: true };
}

/**
 * Run a Whoop sync immediately. Used by the post-connect "Syncing…" trigger so
 * recovery/sleep/strain + workouts show up right after the OAuth round-trip.
 * Revalidates /train too — Whoop workouts render there.
 */
export async function syncWhoopNow(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const result = await syncWhoop(supabase, userId);

  revalidatePath("/dashboard");
  revalidatePath("/train");
  revalidatePath("/settings");

  if (!result.ok) return { ok: false, error: `Sync ${result.status}` };
  return { ok: true };
}

/**
 * Disconnect Strava: deletes the integration row (removing the encrypted tokens
 * entirely) so status reverts to NOT CONNECTED. RLS-scoped + explicit user_id.
 */
export async function disconnectStrava(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "strava");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Run a Strava sync immediately. Used by the post-connect "Syncing…" trigger so
 * activities show up on the train page right after the OAuth round-trip.
 * Revalidates /train + /dashboard + /settings.
 */
export async function syncStravaNow(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const result = await syncStrava(supabase, userId);

  revalidatePath("/dashboard");
  revalidatePath("/train");
  revalidatePath("/settings");

  if (!result.ok) return { ok: false, error: `Sync ${result.status}` };
  return { ok: true };
}

/**
 * Disconnect X: deletes the integration row (removing the encrypted tokens
 * entirely) so status reverts to NOT CONNECTED. RLS-scoped + explicit user_id.
 */
export async function disconnectX(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "x");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Run an X sync immediately. Used by the post-connect "Syncing…" trigger so the
 * follower count shows up right after the OAuth round-trip. Revalidates
 * /dashboard (the Social card renders there) + /settings.
 */
export async function syncXNow(): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const result = await syncX(supabase, userId);

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  if (!result.ok) return { ok: false, error: `Sync ${result.status}` };
  return { ok: true };
}
