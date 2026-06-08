/**
 * X (Twitter) OAuth callback handler.
 *
 * Exchanges the authorization code (with the PKCE verifier) for access +
 * refresh tokens, captures the X user id + handle via a one-shot users/me
 * call, saves everything via the generalized token store, then runs an inline
 * sync so today's follower count lands immediately on return.
 *
 * Two cookies are consumed exactly once by `finish()`:
 *   - `x_oauth_state`    — CSRF state, must match the `state` query param.
 *   - `x_pkce_verifier`  — PKCE verifier, replayed into the token exchange.
 * Both are security-critical; clear them on every exit path.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/x/oauth";
import { getMe } from "@/lib/x/client";
import { markStatusFor, saveTokens } from "@/lib/integrations/store";
import { syncX } from "@/lib/sync/x";

export const maxDuration = 60;

/** Defensively pull the X user id + handle off the typed-`unknown` users/me payload. */
function extractProfile(me: unknown): { x_user_id?: string; username?: string } {
  if (me && typeof me === "object" && "data" in me) {
    const data = (me as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const out: { x_user_id?: string; username?: string } = {};
      if (typeof record.id === "string") out.x_user_id = record.id;
      if (typeof record.username === "string") out.username = record.username;
      return out;
    }
  }
  return {};
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = (query: string) =>
    NextResponse.redirect(new URL(`/settings?${query}`, request.url));

  const cookieStore = await cookies();
  const storedState = cookieStore.get("x_oauth_state")?.value;
  const storedVerifier = cookieStore.get("x_pkce_verifier")?.value;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const finish = (query: string) => {
    const response = settings(query);
    response.cookies.delete("x_oauth_state");
    response.cookies.delete("x_pkce_verifier");
    return response;
  };

  if (oauthError) return finish("error=x");
  if (!code || !state || !storedState || state !== storedState || !storedVerifier) {
    return finish("error=x_state");
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeCode(code, storedVerifier);
    const supabase = await createClient();
    // Capture the X user id + handle (nice-to-have metadata). Never crash the
    // callback on a missing/odd-shaped handle — save tokens regardless.
    let metadata: Record<string, unknown> = {};
    try {
      metadata = extractProfile(await getMe(tokens.accessToken));
    } catch {
      // best-effort — handle is optional, tokens still save below
    }
    await saveTokens(supabase, userId, "x", tokens, metadata);
    await syncX(supabase, userId);
    return finish("connected=x");
  } catch (err) {
    try {
      const supabase = await createClient();
      await markStatusFor(supabase, userId, "x", "error", err instanceof Error ? err.message : "X connect failed");
    } catch {
      // best-effort — never mask the redirect
    }
    return finish("error=x");
  }
}
