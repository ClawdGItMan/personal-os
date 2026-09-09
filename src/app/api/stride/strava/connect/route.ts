import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { stravaConfigured, cookieOptions } from "@/lib/stride/server";
export async function GET(request: Request) {
  if (!stravaConfigured())
    return NextResponse.redirect(
      new URL("/stride?connection=strava-setup", request.url),
    );
  const state = randomBytes(32).toString("hex");
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri:
      process.env.STRIDE_STRAVA_REDIRECT_URI ||
      new URL("/api/stride/strava/callback", request.url).toString(),
    response_type: "code",
    approval_prompt: "force",
    scope: "activity:read_all",
    state,
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("stride_oauth_state", state, {
    ...cookieOptions,
    maxAge: 600,
  });
  return response;
}
