/**
 * Strava OAuth callback handler.
 *
 * Exchanges the authorization code for access + refresh tokens, saves them via
 * the generalized token store, then runs an inline backfill (~30 days of
 * activities) so the dashboard has data immediately on return.
 *
 * State cookie (`strava_oauth_state`) is consumed exactly once by `finish()` to
 * prevent replay — this is security-critical, keep identical to the Whoop flow.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/strava/oauth";
import { markStatusFor, saveTokens } from "@/lib/integrations/store";
import { syncStrava } from "@/lib/sync/strava";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = (query: string) =>
    NextResponse.redirect(new URL(`/settings?${query}`, request.url));

  const cookieStore = await cookies();
  const storedState = cookieStore.get("strava_oauth_state")?.value;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const finish = (query: string) => {
    const response = settings(query);
    response.cookies.delete("strava_oauth_state");
    return response;
  };

  if (oauthError) return finish("error=strava");
  if (!code || !state || !storedState || state !== storedState) {
    return finish("error=strava_state");
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();
    await saveTokens(supabase, userId, "strava", tokens, { athlete_id: tokens.athleteId });
    await syncStrava(supabase, userId);
    return finish("connected=strava");
  } catch (err) {
    try {
      const supabase = await createClient();
      await markStatusFor(supabase, userId, "strava", "error", err instanceof Error ? err.message : "Strava connect failed");
    } catch {
      // best-effort — never mask the redirect
    }
    return finish("error=strava");
  }
}
