import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCalendar } from "@/lib/sync/calendar";

/** Constant-time bearer-token comparison (avoids a timing oracle on CRON_SECRET). */
function authMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vercel Cron entry point — runs every 5 minutes (see `vercel.json`) and syncs
 * every connected Google account's calendar.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled
 * invocations (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * We reject any request whose header doesn't match the configured secret, so
 * the public route can't be triggered by anyone but Vercel's scheduler.
 *
 * Uses the service-role admin client (no user cookie in a cron context). That
 * client bypasses RLS, so each sync is explicitly scoped by `row.user_id`.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authMatches(authHeader, `Bearer ${requireEnv("CRON_SECRET")}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Skip known-lapsed accounts — syncCalendar early-returns on them anyway, but
  // there's no point re-hitting Google for connections the user must reconnect.
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id")
    .eq("provider", "google")
    .eq("status", "connected");

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // Report real outcomes: only count syncs that actually succeeded.
  let synced = 0;
  let failed = 0;
  for (const row of integrations ?? []) {
    const result = await syncCalendar(admin, row.user_id);
    if (result.ok) synced += 1;
    else failed += 1;
  }

  return Response.json({ ok: true, synced, failed });
}
