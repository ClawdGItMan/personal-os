import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  cookieOptions,
  exchangeStrava,
  writeStravaTokens,
} from "@/lib/stride/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = url.searchParams.get("state") || "";
  const expected = jar.get("stride_oauth_state")?.value || "";
  jar.set("stride_oauth_state", "", { ...cookieOptions, maxAge: 0 });
  const redirect = (result: string) =>
    NextResponse.redirect(new URL(`/stride?connection=${result}`, request.url));
  if (url.searchParams.has("error")) return redirect("strava-canceled");
  if (
    !state ||
    !expected ||
    state.length !== expected.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
  )
    return redirect("strava-error");
  const code = url.searchParams.get("code");
  if (
    !code ||
    !(url.searchParams.get("scope") || "")
      .split(/[ ,]/)
      .includes("activity:read_all")
  )
    return redirect("strava-scope");
  try {
    await writeStravaTokens(
      await exchangeStrava({ code, grant_type: "authorization_code" }),
    );
    return redirect("strava-connected");
  } catch {
    return redirect("strava-error");
  }
}
