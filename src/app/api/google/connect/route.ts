import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth";
import { buildConsentUrl } from "@/lib/google/oauth";

/**
 * Starts the Google OAuth flow. Signed-in users get a fresh CSRF `state` (stored
 * in a short-lived httpOnly cookie the callback verifies) and are redirected to
 * Google's consent screen. Signed-out users are bounced to /login.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildConsentUrl(state));

  // CSRF token: the callback rejects any response whose `state` doesn't match
  // this cookie. httpOnly so client JS can't read it; `secure` only in prod so
  // local http dev still works.
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
