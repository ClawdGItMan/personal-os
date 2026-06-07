/**
 * Whoop OAuth callback handler.
 *
 * Exchanges the authorization code for access + refresh tokens, saves them via
 * the generalized token store, then runs an inline backfill (~30 days of health
 * metrics and recent workouts) so the dashboard has data immediately on return.
 *
 * State cookie (`whoop_oauth_state`) is consumed exactly once by `finish()` to
 * prevent replay — this is security-critical, keep identical to the Google flow.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/whoop/oauth";
import { markStatusFor, saveTokens } from "@/lib/integrations/store";
import { syncWhoop } from "@/lib/sync/whoop";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = (query: string) =>
    NextResponse.redirect(new URL(`/settings?${query}`, request.url));

  const cookieStore = await cookies();
  const storedState = cookieStore.get("whoop_oauth_state")?.value;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const finish = (query: string) => {
    const response = settings(query);
    response.cookies.delete("whoop_oauth_state");
    return response;
  };

  if (oauthError) return finish("error=whoop");
  if (!code || !state || !storedState || state !== storedState) {
    return finish("error=whoop_state");
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();
    await saveTokens(supabase, userId, "whoop", tokens);
    await syncWhoop(supabase, userId);
    return finish("connected=whoop");
  } catch (err) {
    try {
      const supabase = await createClient();
      await markStatusFor(supabase, userId, "whoop", "error", err instanceof Error ? err.message : "Whoop connect failed");
    } catch {
      // best-effort — never mask the redirect
    }
    return finish("error=whoop");
  }
}
