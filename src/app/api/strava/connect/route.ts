import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { buildConsentUrl } from "@/lib/strava/oauth";

/**
 * GET /api/strava/connect
 *
 * Initiates the Strava OAuth 2.0 authorization-code flow. Generates a CSRF
 * state token, stores it in a short-lived httpOnly cookie, then redirects
 * the user to the Strava consent screen.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildConsentUrl(state));
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
