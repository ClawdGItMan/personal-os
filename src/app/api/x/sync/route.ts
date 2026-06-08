import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncX } from "@/lib/sync/x";

function authMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const maxDuration = 60;

// Daily cron: sync X (Twitter) follower counts for all connected users
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authMatches(authHeader, `Bearer ${requireEnv("CRON_SECRET")}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "x")
    .eq("status", "connected");
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  let synced = 0;
  let failed = 0;
  for (const row of integrations ?? []) {
    try {
      const result = await syncX(admin, row.user_id);
      if (result.ok) synced += 1;
      else failed += 1;
    } catch {
      // Isolate per user — one throw (token persist, query, touch_last_synced)
      // must not abort the rest of the batch.
      failed += 1;
    }
  }
  return Response.json({ ok: true, synced, failed });
}
