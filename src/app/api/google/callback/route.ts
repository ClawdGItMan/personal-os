import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/google/oauth";
import { markStatus, saveGoogleTokens } from "@/lib/integrations/store";
import { syncCalendar } from "@/lib/sync/calendar";

// The inline backfill (one paginated 37-day calendar pull) runs here, so allow
// up to 60s on Vercel rather than the default function timeout.
export const maxDuration = 60;

/**
 * Google redirects here after consent. We verify the CSRF `state` against the
 * cookie set in /api/google/connect, exchange the code for encrypted tokens,
 * run an initial calendar backfill inline, then return the user to Settings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = (query: string) =>
    NextResponse.redirect(new URL(`/settings?${query}`, request.url));

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error"); // e.g. user clicked "Deny"

  // Whatever happens below, the one-time state cookie is consumed.
  const finish = (query: string) => {
    const response = settings(query);
    response.cookies.delete("google_oauth_state");
    return response;
  };

  if (oauthError) return finish("error=google");
  if (!code || !state || !storedState || state !== storedState) {
    return finish("error=google_state");
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();
    await saveGoogleTokens(supabase, userId, tokens);
    // Initial backfill so the Calendar module has data immediately on return.
    await syncCalendar(supabase, userId);
    return finish("connected=google");
  } catch (err) {
    try {
      const supabase = await createClient();
      await markStatus(
        supabase,
        userId,
        "error",
        err instanceof Error ? err.message : "Google connect failed",
      );
    } catch {
      // best-effort — never mask the redirect
    }
    return finish("error=google");
  }
}
