import { NextResponse } from "next/server";
import {
  exchangeStrava,
  readStravaTokens,
  sameOrigin,
  writeStravaTokens,
} from "@/lib/stride/server";
import type { Run } from "@/lib/stride/types";
import { z } from "zod";
const activitySchema = z.object({
  id: z.number(),
  name: z.string(),
  start_date: z.string().datetime(),
  distance: z.number().positive(),
  moving_time: z.number().positive(),
  sport_type: z.string().optional(),
  type: z.string().optional(),
  average_heartrate: z.number().optional(),
  total_elevation_gain: z.number().optional(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  let tokens = await readStravaTokens();
  if (!tokens)
    return NextResponse.json(
      { error: "Connect your Strava account first." },
      { status: 401 },
    );
  try {
    if (tokens.expires_at < Date.now() / 1000 + 120) {
      tokens = await exchangeStrava({
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      });
      await writeStravaTokens(tokens);
    }
    const runs: Run[] = [];
    let partial = false;
    for (let page = 1; page <= 5; page++) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.search = new URLSearchParams({
        after: String(Math.floor(Date.now() / 1000) - 90 * 86400),
        per_page: "100",
        page: String(page),
      }).toString();
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        return NextResponse.json(
          {
            error:
              response.status === 429
                ? "Strava’s rate limit was reached. Please try again later."
                : "Strava could not sync. Try reconnecting your account.",
          },
          { status: response.status === 429 ? 429 : 502 },
        );
      const activities: unknown = await response.json();
      if (!Array.isArray(activities))
        throw new Error("Invalid activity response");
      for (const raw of activities) {
        const parsed = activitySchema.safeParse(raw);
        if (!parsed.success) continue;
        const a = parsed.data;
        if (
          !["Run", "TrailRun", "VirtualRun"].includes(
            a.sport_type || a.type || "",
          )
        )
          continue;
        runs.push({
          id: `strava-${a.id}`,
          title: a.name,
          date: a.start_date,
          distance: Math.round(a.distance / 10) / 100,
          duration: a.moving_time,
          heartRate: a.average_heartrate
            ? Math.round(a.average_heartrate)
            : null,
          elevation: Math.round(a.total_elevation_gain || 0),
          effort: null,
          pain: false,
          notes: "",
          kind: "Easy run",
          source: "Strava",
        });
      }
      if (activities.length < 100) break;
      if (page === 5) partial = true;
    }
    return NextResponse.json(
      { runs, partial },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Sync could not finish. Your saved runs are safe; please try again.",
      },
      { status: 502 },
    );
  }
}
