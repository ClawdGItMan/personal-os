/**
 * POST /api/apple-health/ingest
 *
 * PUBLIC inbound endpoint — accepts JSON pushes from the Health Auto Export iOS
 * app (HAE). No session cookie; the user is resolved from the ingest token.
 *
 * AUTH MODEL: Each user generates a per-user ingest token in Settings. The token
 * format is `<userId>.<secret>`; only `sha256(secret)` is stored in
 * integrations.metadata.token_hash. The route resolves the user from the token,
 * verifies the secret against the stored hash with a constant-time compare, and
 * rejects bad tokens BEFORE reading the request body — cheap rejection of floods.
 *
 * SECURITY NOTES:
 *  - Bad-token floods are rejected at step 2 (one DB lookup + hash compare) BEFORE
 *    any sync_runs write or body parse. The DB-window rate limit (step 4) therefore
 *    meters ONLY authenticated traffic.
 *  - Unauthenticated abuse protection rests on the Vercel platform/firewall layer.
 *    RECOMMENDATION: Add a Vercel Firewall rate-limit rule on path
 *    `/api/apple-health/ingest` (e.g. ≤ 30 req / 10 min per IP) in the Vercel
 *    dashboard. This covers unauthenticated floods before they reach this function.
 *  - The service-role admin client bypasses RLS. EVERY query is explicitly scoped
 *    by the userId resolved from the token — the request body is never trusted for
 *    user identity.
 *  - No health values appear in any log line — only metric names, counts, and stages.
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIngestToken } from "@/lib/apple-health/ingest-token";
import { compareToken } from "@/lib/crypto/tokens";
import { parseHaePayload } from "@/lib/apple-health/parser";
import { ingestAppleHealth } from "@/lib/sync/apple-health";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Maximum accepted Content-Length in bytes (4 MB). HAE Batch Requests splits
 *  large payloads so individual POSTs stay well under this ceiling. */
const MAX_BODY_BYTES = 4_000_000;

export async function POST(request: NextRequest) {
  // -----------------------------------------------------------------------
  // Step 1: Extract the token from Authorization header (fall back to X-API-Key).
  // splitIngestToken strips "Bearer " and splits on the first dot.
  // -----------------------------------------------------------------------
  const rawAuth =
    request.headers.get("authorization") ?? request.headers.get("x-api-key");
  const parsed = splitIngestToken(rawAuth ?? "");
  if (!parsed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, secret } = parsed;

  // -----------------------------------------------------------------------
  // Step 2: Resolve + verify the token BEFORE parsing the body.
  // One indexed integrations lookup + constant-time hash compare. Bad-token
  // floods are rejected here and never reach the parser or writers.
  // -----------------------------------------------------------------------
  const admin = createAdminClient();

  let storedHash: string | null = null;
  try {
    const { data: integration, error } = await admin
      .from("integrations")
      .select("metadata")
      .eq("user_id", userId)
      .eq("provider", "apple_health")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const meta = integration.metadata as Record<string, unknown> | null;
    const hash = meta?.["token_hash"];
    if (typeof hash !== "string") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    storedHash = hash;
  } catch (err) {
    // Integration lookup failed — treat as unauthorized to avoid leaking info.
    // Log a count only (no values, no userId in the message).
    console.error("[apple-health/ingest] integration lookup error:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!compareToken(secret, storedHash)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // -----------------------------------------------------------------------
  // Step 3: Size cap — check Content-Length before reading the body.
  // -----------------------------------------------------------------------
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  // -----------------------------------------------------------------------
  // Step 4: Rate limit (DB-counted window — meters authenticated traffic only).
  //
  // Count this user's sync_runs for provider='apple_health' in the last 10 min.
  // If >= 30, return 429. This is safe because bad tokens are rejected at step 2
  // before any sync_runs write, so this counter only rises for authenticated pushes.
  //
  // NOTE: Unauthenticated flood protection is NOT covered by this DB window.
  // Add a Vercel Firewall rule on /api/apple-health/ingest (≤30 req/10min per IP)
  // in the Vercel dashboard to cover that case at the edge before this function runs.
  // -----------------------------------------------------------------------
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "apple_health")
    .gte("started_at", windowStart);

  if (countError) {
    // Fail open — if we can't count, proceed (don't block legitimate pushes
    // over a transient DB error).
    console.error("[apple-health/ingest] rate limit count error:", countError.message);
  } else if ((count ?? 0) >= 30) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // -----------------------------------------------------------------------
  // Step 5: Read + parse the body.
  // -----------------------------------------------------------------------
  let rawBody: unknown;
  try {
    // Defensive: also cap the raw text length in case Content-Length was absent/spoofed.
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    rawBody = JSON.parse(text);
  } catch {
    // JSON parse failure — log the stage only (no values).
    try {
      await admin.from("error_events").insert({
        user_id: userId,
        provider: "apple_health",
        severity: "warn",
        message: "Request body is not valid JSON",
        context: { stage: "parse" },
      });
    } catch {
      // swallow logging failure
    }
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsedPayload: ReturnType<typeof parseHaePayload>;
  try {
    parsedPayload = parseHaePayload(rawBody);
  } catch (err) {
    // Zod validation failure — log the failing field path only (no values).
    const fieldPath =
      err != null &&
      typeof err === "object" &&
      "errors" in err &&
      Array.isArray((err as { errors: unknown[] }).errors)
        ? (err as { errors: Array<{ path?: unknown[] }> }).errors
            .map((e) => e.path?.join(".") ?? "unknown")
            .join(", ")
        : "unknown";

    try {
      await admin.from("error_events").insert({
        user_id: userId,
        provider: "apple_health",
        severity: "warn",
        // Field path only — NO values from the payload.
        message: `Payload validation failed at: ${fieldPath}`,
        context: { stage: "parse" },
      });
    } catch {
      // swallow logging failure
    }
    return Response.json({ error: "Invalid payload", fields: fieldPath }, { status: 400 });
  }

  // -----------------------------------------------------------------------
  // Step 6: Ingest.
  // Return 200 even on partial so HAE does not hard-retry a partial ingest.
  // Unexpected throws → 500.
  // -----------------------------------------------------------------------
  try {
    const result = await ingestAppleHealth(admin, userId, parsedPayload);
    return Response.json({
      ok: result.ok,
      status: result.status,
      metricDays: result.metricDays,
      workoutRows: result.workoutRows,
    });
  } catch (err) {
    console.error(
      "[apple-health/ingest] unexpected ingest error:",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// NOTES / DEVIATIONS
//
// Rate limiting — Option B (in-route DB-counted window) implemented:
//   After auth (step 4), count this user's sync_runs rows for
//   provider='apple_health' in the last 10 minutes. If >= 30 → 429.
//   Chosen over Option A (Vercel Firewall rule) because it is self-contained
//   and testable without a dashboard dependency.
//
// IMPORTANT: bad-token floods are rejected at step 2 (one indexed integrations
//   lookup + hash compare) BEFORE any sync_runs write, so the DB window only
//   meters AUTHENTICATED traffic. Unauthenticated abuse protection is NOT
//   provided by the DB window.
//
// RECOMMENDED ACTION for Max: Add a Vercel Firewall rate-limit rule on path
//   /api/apple-health/ingest (e.g. ≤ 30 req / 10 min per IP) in the Vercel
//   dashboard. This covers unauthenticated floods at the edge before the
//   function runs, complementing the in-route authenticated-traffic window.
// ---------------------------------------------------------------------------
