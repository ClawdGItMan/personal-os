import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStrava } from "@/lib/sync/strava";

function authMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const maxDuration = 60;

// Hourly cron: sync Strava activity data for all connected users
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authMatches(authHeader, `Bearer ${requireEnv("CRON_SECRET")}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "strava")
    .eq("status", "connected");
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  let synced = 0;
  let failed = 0;
  for (const row of integrations ?? []) {
    try {
      const result = await syncStrava(admin, row.user_id);
      if (result.ok) synced += 1;
      else failed += 1;
    } catch {
      // syncStrava early-returns on auth failures rather than wrapping its whole
      // body, so a few awaits (token persist, profiles query, touch_last_synced)
      // can still throw. Isolate per user — one throw must not abort the batch.
      failed += 1;
    }
  }
  return Response.json({ ok: true, synced, failed });
}
