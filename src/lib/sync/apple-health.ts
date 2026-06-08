import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { touchLastSyncedFor } from "@/lib/integrations/store";
import { mapMetricsToDays } from "@/lib/apple-health/health";
import { mapWorkout } from "@/lib/apple-health/workouts";
import { upsertHealthSnapshots, upsertWorkouts } from "@/lib/sync/whoop";
import type { ParsedHaePayload } from "@/lib/apple-health/parser";

/** Shared client type — satisfied by both the cookie client and the service-role
 *  admin client, so both paths can reuse this sync core. */
type Client = SupabaseClient<Database>;

/** Provider string EXACTLY as stored in integrations, sync_runs, and error_events. */
const PROVIDER = "apple_health" as const;

/** Result of an ingest attempt.
 *  `ok` is true for both `ok` and `partial` (data landed); false only on unexpected throw.
 *  `metricDays` / `workoutRows` count the rows upserted by each stream. */
export interface IngestAppleHealthResult {
  ok: boolean;
  status: "ok" | "partial";
  metricDays: number;
  workoutRows: number;
}

/** Insert a sync_runs row (status ∈ {ok,partial,failed}). */
async function writeSyncRun(
  client: Client,
  userId: string,
  startedAt: string,
  rowsSynced: number,
  status: "ok" | "partial" | "failed",
  errorMessage?: string,
): Promise<void> {
  await client.from("sync_runs").insert({
    user_id: userId,
    provider: PROVIDER,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rows_synced: rowsSynced,
    status,
    error_message: errorMessage ?? null,
  });
}

/**
 * Ingest an already-validated HAE payload for a user.
 *
 * The route parses the raw JSON and passes the typed payload here — keeps the
 * route thin and this function independently testable.
 *
 * Two streams run in sequence (not concurrently — simpler, consistent with
 * syncWhoop's sequential stream pattern):
 *  - Stream A: metrics → health_snapshots (partial column-merge upsert)
 *  - Stream B: workouts → workouts (blind upsert by deterministic external_id)
 *
 * Failure isolation: each stream has its own try/catch. A stream error logs an
 * error_events row (NO health values — counts/stage only), sets a `partial` flag,
 * and lets the other stream continue. The caller always gets an `ok: true` result
 * (even on `partial`) so HAE does not hard-retry a partial ingest as a failure.
 *
 * Uses the PASSED client; never creates one. Every query is scoped by userId.
 *
 * Provider string: "apple_health" (underscore) — matches the Settings row and
 * the integrations lookup. Never "apple-health".
 */
export async function ingestAppleHealth(
  client: Client,
  userId: string,
  payload: ParsedHaePayload,
): Promise<IngestAppleHealthResult> {
  const startedAt = new Date().toISOString();

  let metricDays = 0;
  let workoutRows = 0;
  let anyStreamFailed = false;
  let firstStreamError: string | undefined;

  /** Best-effort error_events insert — never lets a logging failure mask the stream outcome. */
  async function logStreamError(stage: string, message: string): Promise<void> {
    anyStreamFailed = true;
    firstStreamError ??= message;
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: PROVIDER,
        severity: "error",
        // NO health values — counts/stage only (security: no PII in logs)
        message,
        context: { stage },
      });
    } catch {
      // swallow
    }
  }

  // --- Stream A: metrics → health_snapshots ---
  try {
    const rows = mapMetricsToDays(payload.metrics).map((row) => ({ ...row, user_id: userId }));
    await upsertHealthSnapshots(client, rows);
    metricDays = rows.length;
  } catch (err) {
    await logStreamError(
      "ingestMetrics",
      err instanceof Error ? err.message : String(err),
    );
  }

  // --- Stream B: workouts → workouts ---
  try {
    const rows = payload.workouts
      .map(mapWorkout)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((row) => ({ ...row, user_id: userId }));
    await upsertWorkouts(client, rows);
    workoutRows = rows.length;
  } catch (err) {
    await logStreamError(
      "ingestWorkouts",
      err instanceof Error ? err.message : String(err),
    );
  }

  // --- Finish: touch last_synced_at + write sync_runs row ---
  await touchLastSyncedFor(client, userId, PROVIDER);

  const status = anyStreamFailed ? "partial" : "ok";
  await writeSyncRun(
    client,
    userId,
    startedAt,
    metricDays + workoutRows,
    status,
    anyStreamFailed ? firstStreamError : undefined,
  );

  return { ok: true, status, metricDays, workoutRows };
}
