import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncWhoop } from "@/lib/sync/whoop";

function authMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const maxDuration = 60;

// Hourly cron: sync Whoop health + workout data for all connected users
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authMatches(authHeader, `Bearer ${requireEnv("CRON_SECRET")}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "whoop")
    .eq("status", "connected");
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  let synced = 0;
  let failed = 0;
  for (const row of integrations ?? []) {
    const result = await syncWhoop(admin, row.user_id);
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return Response.json({ ok: true, synced, failed });
}
