import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getIntegration,
  markStatusFor,
  persistRefreshedTokens,
  readTokens,
  touchLastSyncedFor,
} from "@/lib/integrations/store";
import { refreshTokens } from "@/lib/whoop/oauth";
import { WhoopApiError } from "@/lib/whoop/client";
import {
  assembleHealthDays,
  fetchHealthWindow,
  mapHealthDay,
} from "@/lib/whoop/health";
import { fetchWorkouts } from "@/lib/whoop/workouts";

/** Shared client type — satisfied by both the cookie client (`@/lib/supabase/server`)
 * and the service-role admin client (`@/lib/supabase/admin`), so both the inline
 * backfill (callback) and the cron path reuse this sync core. */
type Client = SupabaseClient<Database>;

/** Provider literal recorded on `health_snapshots`, `workouts`, `sync_runs`, and `error_events`. */
const SYNC_PROVIDER = "whoop" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Refresh the access token this many ms BEFORE its recorded expiry, to avoid
 * racing a mid-fetch 401 (Whoop access tokens are short-lived). */
const REFRESH_SKEW_MS = 60_000;

/**
 * Result of a sync attempt.
 *
 * `ok` is true for both `ok` and `partial` (the sync completed and data landed);
 * it is false only for the early `expired`/`error` returns where nothing synced.
 * `healthRows`/`workoutRows` count the rows upserted by each stream.
 */
export interface SyncWhoopResult {
  ok: boolean;
  status: "ok" | "partial" | "expired" | "error";
  healthRows: number;
  workoutRows: number;
}

/**
 * Internal sentinel: thrown from the mid-fetch 401 retry wrapper when the
 * one-shot refresh itself fails. A plain throw from inside a stream would be
 * caught by that stream's own try/catch and mis-routed to the DATA-error path
 * (→ `partial`, status stays `connected`). This distinct type lets the stream's
 * catch re-detect an AUTH-EXPIRED condition and escape to mark `expired`.
 */
class WhoopAuthExpired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhoopAuthExpired";
  }
}

/** Human-readable message for a `refreshTokens` failure (used for last_error / sync_runs). */
function refreshErrorMessage(err: unknown): string {
  return err instanceof Error ? `Token refresh failed: ${err.message}` : "Token refresh failed";
}

/**
 * Sync the user's Whoop health (recovery/sleep/strain) into `health_snapshots`
 * and workouts into `workouts`.
 *
 * Caller supplies the Supabase client (cookie client for the inline backfill,
 * service-role admin client for cron) — this function NEVER creates one. Because
 * the admin client bypasses RLS, every read and write is explicitly scoped by
 * `user_id`.
 *
 * Window: the first sync (no `last_synced_at`) backfills `[now-30d, now]`;
 * incremental syncs look at `[now-2d, now]` (overlap re-upserts recently scored
 * days, which is idempotent thanks to the unique keys).
 *
 * Failure isolation (the subtle part):
 *  - AUTH-EXPIRED (no access token, missing refresh token, or any `refreshTokens`
 *    failure — including one triggered by a mid-fetch 401 retry) → mark the
 *    integration `expired`, record a FAILED `sync_runs` row, early-return with
 *    `status:"expired"`. This is the ONLY path that flips status away from
 *    `connected` and raises the reconnect banner.
 *  - DATA error (any non-auth throw from a stream's fetch/upsert) → log an
 *    `error_events` row, set the `partial` flag, KEEP `status:"connected"`, and
 *    continue to the other stream. A data hiccup must never flip to `expired`.
 */
export async function syncWhoop(client: Client, userId: string): Promise<SyncWhoopResult> {
  const startedAt = new Date().toISOString();

  // 1. Integration must exist.
  const integration = await getIntegration(client, userId, SYNC_PROVIDER);
  if (!integration) {
    return { ok: false, status: "error", healthRows: 0, workoutRows: 0 };
  }

  // 2. Must have a usable access token.
  const { accessToken, refreshToken } = readTokens(integration);
  if (!accessToken) {
    await markStatusFor(client, userId, SYNC_PROVIDER, "expired", "Missing access token");
    await writeSyncRun(client, userId, startedAt, 0, "failed", "Missing access token");
    return { ok: false, status: "expired", healthRows: 0, workoutRows: 0 };
  }

  // Mutable token state shared across both streams. A refresh in either stream
  // (proactive below, or a mid-fetch 401) updates these for the other stream.
  let token = accessToken;
  let rt = refreshToken;

  // 3. Proactive refresh — Whoop's `metadata.expires_at` is epoch MILLISECONDS
  //    (`Date.now() + expires_in*1000`). Refresh if already past or within the
  //    skew window of now.
  const metadata = (integration.metadata ?? {}) as Record<string, unknown>;
  const expiresAt = Number(metadata.expires_at ?? 0);
  if (expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    // Guard the refresh token (mirrors calendar.ts's `&& refreshToken` guard).
    if (!rt) {
      await markStatusFor(client, userId, SYNC_PROVIDER, "expired", "Missing refresh token");
      await writeSyncRun(client, userId, startedAt, 0, "failed", "Missing refresh token");
      return { ok: false, status: "expired", healthRows: 0, workoutRows: 0 };
    }

    let refreshed;
    try {
      refreshed = await refreshTokens(rt);
    } catch (err) {
      const msg = refreshErrorMessage(err);
      await markStatusFor(client, userId, SYNC_PROVIDER, "expired", msg);
      await writeSyncRun(client, userId, startedAt, 0, "failed", msg);
      return { ok: false, status: "expired", healthRows: 0, workoutRows: 0 };
    }

    // Write-before-use: Whoop ROTATES (single-use) refresh tokens — the one we
    // just used is now invalidated server-side. Persist the rotated pair BEFORE
    // using the new access token, so a failed persist never leaves us syncing
    // with a token we can't recover.
    await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
    token = refreshed.accessToken;
    rt = refreshed.refreshToken;
  }

  // 4. Window: backfill on first sync, otherwise a short overlapping incremental.
  const now = Date.now();
  const window = integration.last_synced_at
    ? {
        start: new Date(now - 2 * DAY_MS).toISOString(),
        end: new Date(now).toISOString(),
      }
    : {
        start: new Date(now - 30 * DAY_MS).toISOString(),
        end: new Date(now).toISOString(),
      };

  // 5. Timezone — `profiles` PK is `id` (= the auth user id). Default "UTC".
  const { data: profile } = await client
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const timeZone = profile?.timezone ?? "UTC";

  /**
   * One-shot mid-fetch 401 refresh shared across both streams. Runs the supplied
   * fetch with the current `token`; on a `WhoopApiError` 401 it refreshes ONCE
   * (guarded), persists (write-before-use), updates `token`/`rt`, and retries.
   * A refresh failure here throws `WhoopAuthExpired` so the stream's catch routes
   * it to the AUTH-EXPIRED path instead of the DATA-error path. We never refresh
   * more than once for 401s: if the retried fetch 401s again it propagates as a
   * normal error.
   *
   * Correctness relies on the two streams running SEQUENTIALLY (step 6 then step
   * 7): the shared `refreshedFor401` flag and the `token`/`rt` mutation are not
   * concurrency-safe. Do NOT wrap the streams in `Promise.all`.
   */
  let refreshedFor401 = false;
  async function withAuthRetry<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
    try {
      return await run(token);
    } catch (err) {
      if (!(err instanceof WhoopApiError) || err.status !== 401 || refreshedFor401) {
        throw err;
      }
      refreshedFor401 = true;

      if (!rt) {
        throw new WhoopAuthExpired("Missing refresh token");
      }
      let refreshed;
      try {
        refreshed = await refreshTokens(rt);
      } catch (refreshErr) {
        throw new WhoopAuthExpired(refreshErrorMessage(refreshErr));
      }
      // Write-before-use again (single-use rotated token).
      await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
      token = refreshed.accessToken;
      rt = refreshed.refreshToken;

      return await run(token);
    }
  }

  let healthRows = 0;
  let workoutRows = 0;
  let anyStreamFailed = false;
  // Captured to surface on the sync_runs row when a DATA error degrades to partial.
  let firstStreamError: string | undefined;

  // Set by a stream when a mid-fetch-401 refresh fails (surfaced as
  // `WhoopAuthExpired`). We can't early-return from inside the per-stream
  // try/catch, so streams record the message here and the AUTH-EXPIRED routing
  // (step 8) acts on it after the streams run; the `if (!authExpiredMessage)`
  // guards skip the remaining stream(s) once one has hit this condition.
  let authExpiredMessage: string | undefined;

  async function logDataError(stage: string, message: string): Promise<void> {
    anyStreamFailed = true;
    firstStreamError ??= message;
    // Best-effort — never let a logging failure mask the stream's outcome.
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: SYNC_PROVIDER,
        severity: "error",
        message,
        context: { stage },
      });
    } catch {
      // swallow
    }
  }

  // 6. Stream A — health snapshots (per-day individual upsert via shared helper;
  //    each row's column set differs, so upsertHealthSnapshots loops individually).
  if (!authExpiredMessage) {
    try {
      const raw = await withAuthRetry((t) => fetchHealthWindow(t, window));
      const days = assembleHealthDays(raw, timeZone);
      const partialRows = days.map((day) => ({ ...mapHealthDay(day), user_id: userId }));
      await upsertHealthSnapshots(client, partialRows);
      healthRows = partialRows.length;
    } catch (err) {
      if (err instanceof WhoopAuthExpired) {
        authExpiredMessage = err.message;
      } else {
        await logDataError("syncWhoopHealth", err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 7. Stream B — workouts (single batch upsert via shared helper).
  if (!authExpiredMessage) {
    try {
      const rows = (await withAuthRetry((t) => fetchWorkouts(t, window))).map((r) => ({
        ...r,
        user_id: userId,
      }));
      await upsertWorkouts(client, rows);
      workoutRows = rows.length;
    } catch (err) {
      if (err instanceof WhoopAuthExpired) {
        authExpiredMessage = err.message;
      } else {
        await logDataError("syncWhoopWorkouts", err instanceof Error ? err.message : String(err));
      }
    }
  }

  // 8. AUTH-EXPIRED routing — a refresh failure (proactive already returned
  //    above; this catches a mid-fetch-401 refresh failure surfaced from either
  //    stream) flips the integration to `expired` and records a failed run.
  if (authExpiredMessage) {
    await markStatusFor(client, userId, SYNC_PROVIDER, "expired", authExpiredMessage);
    await writeSyncRun(client, userId, startedAt, 0, "failed", authExpiredMessage);
    return { ok: false, status: "expired", healthRows: 0, workoutRows: 0 };
  }

  // 9. Finish. A DATA error in either stream degrades the run to `partial` but
  //    keeps `status:"connected"` (no reconnect banner for a data hiccup).
  await touchLastSyncedFor(client, userId, SYNC_PROVIDER);
  const status = anyStreamFailed ? "partial" : "ok";
  await writeSyncRun(
    client,
    userId,
    startedAt,
    healthRows + workoutRows,
    status,
    anyStreamFailed ? firstStreamError : undefined,
  );

  return { ok: true, status, healthRows, workoutRows };
}

/**
 * Partial column-merge upsert into `health_snapshots`.
 * Each row carries ONLY user_id, date, source, and the present metric columns.
 * ON CONFLICT DO UPDATE sets only the supplied columns — other sources' columns
 * survive untouched (Supabase upsert sends only the keys present in the row object).
 * No-op when rows is empty.
 */
export async function upsertHealthSnapshots(
  client: Client,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  for (const row of rows) {
    const { error } = await client
      .from("health_snapshots")
      // Cast required: callers supply partial rows (varying key sets per source).
      // The partial-merge contract is enforced by the caller, not TS generics here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(row as any, { onConflict: "user_id,date" });
    if (error) throw new Error(error.message);
  }
}

/**
 * Single-source-owned rows; blind upsert into `workouts`.
 * Caller is responsible for filtering out any rows with a null external_id.
 * No-op when rows is empty.
 */
export async function upsertWorkouts(
  client: Client,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client
    .from("workouts")
    // Cast required: callers supply rows assembled at runtime from multiple sources.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any, { onConflict: "user_id,source,external_id" });
  if (error) throw new Error(error.message);
}

/** Insert a sync_runs row (status ∈ {ok,partial,failed}); user_id is NOT NULL. */
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
    provider: SYNC_PROVIDER,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rows_synced: rowsSynced,
    status,
    error_message: errorMessage ?? null,
  });
}
