import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { buildConsentUrl, generatePkce } from "@/lib/x/oauth";

/**
 * GET /api/x/connect
 *
 * Initiates the X (Twitter) OAuth 2.0 authorization-code flow with PKCE.
 * Generates a CSRF state token plus a PKCE verifier/challenge pair, stores
 * BOTH the state and the verifier in short-lived httpOnly cookies, then
 * redirects the user to the X consent screen. The callback replays the
 * verifier and checks the state.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generatePkce();
  const response = NextResponse.redirect(buildConsentUrl(state, challenge));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  // Distinct names (x_oauth_state / x_pkce_verifier) so they never collide
  // with google_/whoop_/strava_oauth_state cookies.
  response.cookies.set("x_oauth_state", state, cookieOptions);
  response.cookies.set("x_pkce_verifier", verifier, cookieOptions);
  return response;
}
