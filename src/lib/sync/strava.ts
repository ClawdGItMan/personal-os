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
import { refreshTokens } from "@/lib/strava/oauth";
import { StravaApiError } from "@/lib/strava/client";
import { fetchActivities } from "@/lib/strava/workouts";

/**
 * Strava sync core — single stream (workouts only).
 *
 * Mirrors `src/lib/sync/whoop.ts` Stream B but simpler: Strava has no
 * health/recovery/sleep equivalent, so there is NO `health_snapshots` write
 * and NO partial-merge logic. A plain upsert on `(user_id, source, external_id)`
 * is correct because each row is single-source-owned.
 *
 * Key epoch-unit distinction (a real footgun — keep these straight):
 * - `metadata.expires_at` is epoch MILLISECONDS (oauth.ts converts Strava's
 *   epoch-seconds × 1000 on the way in). Compare against `Date.now()`.
 * - `after`/`before` for the activity window are epoch SECONDS (Strava API
 *   convention). Convert ms → sec with `Math.floor(ms/1000)` before fetching.
 *
 * Strava ROTATES the refresh token on every use. The old token is invalidated
 * the moment it is presented. The sync core therefore uses a WRITE-BEFORE-USE
 * strategy: persist the new rotated token pair BEFORE using the new access
 * token. A failed persist must not leave us syncing with a token we cannot
 * recover — that would permanently brick the connection.
 *
 * Failure isolation:
 * - AUTH-EXPIRED (missing tokens, any refresh failure, 401 after one retry)
 *   → mark integration `expired`, record `failed` sync_run, return
 *     {ok:false, status:"expired"}. This is the ONLY path that raises the
 *     reconnect banner.
 * - DATA hiccup (non-401 StravaApiError, parse error, upsert error)
 *   → keep integration `status:'connected'`, record `error_events` +
 *     `failed`/`partial` sync_run, return {ok:false, status:"error"}.
 *     A data hiccup must NEVER flip status to `expired`.
 */

/** Shared client type — satisfied by both cookie and service-role admin clients. */
type Client = SupabaseClient<Database>;

/** Provider literal recorded on `workouts`, `sync_runs`, and `error_events`. */
const SYNC_PROVIDER = "strava" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Refresh the access token this many ms BEFORE its recorded expiry. */
const REFRESH_SKEW_MS = 60_000;

/** Result of a sync attempt. */
export interface SyncStravaResult {
  ok: boolean;
  status: "ok" | "partial" | "expired" | "error";
  synced: number;
}

/** Human-readable message for a `refreshTokens` failure. */
function refreshErrorMessage(err: unknown): string {
  return err instanceof Error ? `Token refresh failed: ${err.message}` : "Token refresh failed";
}

/**
 * Sync the user's Strava activities into `workouts`.
 *
 * Caller supplies the Supabase client — this function NEVER creates one. The
 * admin client bypasses RLS; every read/write is explicitly scoped by `user_id`.
 *
 * Window:
 * - First sync (no `last_synced_at`): backfill `[now-30d, now]`
 * - Incremental: `[now-2d, now]` (overlap re-upserts recent activities,
 *   idempotent on the unique key)
 *
 * All window timestamps are converted from ms → epoch SECONDS before being
 * passed to `fetchActivities` (Strava API convention).
 */
export async function syncStrava(client: Client, userId: string): Promise<SyncStravaResult> {
  const startedAt = new Date().toISOString();

  // 1. Integration must exist.
  const integration = await getIntegration(client, userId, SYNC_PROVIDER);
  if (!integration) {
    return { ok: false, status: "error", synced: 0 };
  }

  // 2. Must have a usable access token.
  const { accessToken, refreshToken } = readTokens(integration);
  if (!accessToken) {
    await markStatusFor(client, userId, SYNC_PROVIDER, "expired", "Missing access token");
    await writeSyncRun(client, userId, startedAt, 0, "failed", "Missing access token");
    return { ok: false, status: "expired", synced: 0 };
  }

  // Mutable token state — a refresh (proactive or mid-fetch 401) updates both.
  let token = accessToken;
  let rt = refreshToken;

  // 3. Proactive refresh.
  //    `metadata.expires_at` is epoch MILLISECONDS (oauth.ts converts Strava's
  //    epoch-seconds × 1000 on the way in). Compare against Date.now().
  const metadata = (integration.metadata ?? {}) as Record<string, unknown>;
  const expiresAt = Number(metadata.expires_at ?? 0);
  if (expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    // Guard refresh token FIRST — Strava ROTATES single-use tokens.
    // If we have no refresh token, the connection is permanently bricked.
    if (!rt) {
      await markStatusFor(client, userId, SYNC_PROVIDER, "expired", "Missing refresh token");
      await writeSyncRun(client, userId, startedAt, 0, "failed", "Missing refresh token");
      return { ok: false, status: "expired", synced: 0 };
    }

    let refreshed;
    try {
      refreshed = await refreshTokens(rt);
    } catch (err) {
      const msg = refreshErrorMessage(err);
      await markStatusFor(client, userId, SYNC_PROVIDER, "expired", msg);
      await writeSyncRun(client, userId, startedAt, 0, "failed", msg);
      return { ok: false, status: "expired", synced: 0 };
    }

    // WRITE-BEFORE-USE: Strava invalidated the old refresh token the moment we
    // called refreshTokens. Persist the new rotated pair BEFORE using the new
    // access token. A failed persist here would permanently brick the connection
    // (the old token is dead, the new one is unpersisted).
    await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
    token = refreshed.accessToken;
    rt = refreshed.refreshToken;
  }

  // 4. Window — epoch MILLISECONDS → epoch SECONDS for the Strava API.
  //    (Distinct unit from metadata.expires_at which stays in ms.)
  const now = Date.now();
  const windowMs = integration.last_synced_at
    ? { afterMs: now - 2 * DAY_MS, beforeMs: now }
    : { afterMs: now - 30 * DAY_MS, beforeMs: now };

  // Strava `after`/`before` are epoch SECONDS.
  const after = Math.floor(windowMs.afterMs / 1000);
  const before = Math.floor(windowMs.beforeMs / 1000);

  // 5. Fetch + map + upsert — single stream (workouts only, NO health_snapshots).
  //    On a 401, refresh once (write-before-use) and retry. Any non-401 error is
  //    a data hiccup: log it, keep status:'connected', return {ok:false}.
  let rows: Array<import("@/lib/strava/workouts").StravaWorkoutRow & { user_id: string }>;

  let refreshedFor401 = false;

  try {
    let fetchToken = token;
    let fetchResult;

    try {
      fetchResult = await fetchActivities(fetchToken, { after, before });
    } catch (err) {
      // Mid-fetch 401 → refresh once (write-before-use), then retry.
      if (err instanceof StravaApiError && err.status === 401 && !refreshedFor401) {
        refreshedFor401 = true;

        if (!rt) {
          const msg = "Missing refresh token on 401 retry";
          await markStatusFor(client, userId, SYNC_PROVIDER, "expired", msg);
          await writeSyncRun(client, userId, startedAt, 0, "failed", msg);
          return { ok: false, status: "expired", synced: 0 };
        }

        let refreshed;
        try {
          refreshed = await refreshTokens(rt);
        } catch (refreshErr) {
          const msg = refreshErrorMessage(refreshErr);
          await markStatusFor(client, userId, SYNC_PROVIDER, "expired", msg);
          await writeSyncRun(client, userId, startedAt, 0, "failed", msg);
          return { ok: false, status: "expired", synced: 0 };
        }

        // Write-before-use (same pattern as proactive refresh).
        await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
        fetchToken = refreshed.accessToken;
        rt = refreshed.refreshToken;

        // Retry with the new token.
        fetchResult = await fetchActivities(fetchToken, { after, before });
      } else {
        // Non-401 error or second 401 — treat as data hiccup.
        throw err;
      }
    }

    // Add user_id before upsert.
    rows = fetchResult.map((r) => ({ ...r, user_id: userId }));

    if (rows.length > 0) {
      const { error } = await client
        .from("workouts")
        .upsert(rows, { onConflict: "user_id,source,external_id" });
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    // DATA hiccup — keep integration status:'connected', do NOT flip to expired.
    const message = err instanceof Error ? err.message : String(err);
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: SYNC_PROVIDER,
        severity: "error",
        message,
        context: { stage: "syncStravaActivities" },
      });
    } catch {
      // best-effort — swallow logging failure
    }
    await writeSyncRun(client, userId, startedAt, 0, "failed", message);
    return { ok: false, status: "error", synced: 0 };
  }

  // 6. Success.
  await touchLastSyncedFor(client, userId, SYNC_PROVIDER);
  await writeSyncRun(client, userId, startedAt, rows.length, "ok");

  return { ok: true, status: "ok", synced: rows.length };
}

/** Insert a sync_runs row (status ∈ {ok, partial, failed}); user_id is NOT NULL. */
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
