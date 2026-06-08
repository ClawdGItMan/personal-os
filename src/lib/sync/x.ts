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
import { refreshTokens } from "@/lib/x/oauth";
import { XApiError, getMe } from "@/lib/x/client";
import { mapFollowerCount } from "@/lib/x/social";
import { todayISO } from "@/lib/format";

/**
 * X (Twitter) sync core — single stream, collapsed to ONE scalar.
 *
 * Mirrors `src/lib/sync/strava.ts` (single-stream) but the "stream" here is a
 * single read → single scalar → single upsert (or skip): we read the
 * authenticated user via `getMe`, extract the follower count with the pure
 * `mapFollowerCount`, and upsert one row into `social_followers`
 * (`platform='X'`, `source='api'`). There is NO `health_snapshots` or
 * `workouts` write — the ONLY write target is `social_followers`.
 *
 * Type-safety boundary (CARRY-FORWARD from Group A): `getMe` returns `unknown`
 * on purpose — the response-shape contract is owned ENTIRELY by
 * `mapFollowerCount`. This sync core passes `getMe`'s result STRAIGHT into
 * `mapFollowerCount` and never reaches into `.data`/`.public_metrics` itself.
 *
 * Refresh handling (the real risk — runs ~daily because X access tokens are
 * short-lived ~2h, so the overnight gap almost always expires them):
 * - `metadata.expires_at` is epoch MILLISECONDS (the oauth lib stored
 *   `Date.now() + expires_in*1000`). Compare against `Date.now() + skew`.
 * - X ROTATES the refresh token: the old one is invalidated the instant it is
 *   used. The sync core therefore uses a WRITE-BEFORE-USE strategy: persist the
 *   new rotated pair BEFORE using the new access token. A failed persist must
 *   not leave us syncing with an unpersisted token — that would permanently
 *   brick the connection (old token dead, new one unsaved).
 *
 * Failure isolation:
 * - AUTH-EXPIRED (missing tokens, any refresh failure, 401 after one retry)
 *   → mark integration `expired`, record a `failed` sync_run, return
 *     {ok:false, status:"expired"}. This is the ONLY path that raises the
 *     reconnect banner. We do NOT throw — an auth failure raises the banner, a
 *     data hiccup does not.
 * - DATA hiccup (malformed/empty/non-numeric read → mapFollowerCount null, or a
 *   non-401 XApiError) → keep integration `status:'connected'`, record an
 *   `error_events` row + a `partial` sync_run, do NOT write `social_followers`
 *   (never clobber a good prior count), return {ok:false, status:"partial"/"error"}.
 *   A data hiccup must NEVER flip status to `expired`.
 */

/** Shared client type — satisfied by both the cookie client and the
 * service-role admin client, so user and cron paths reuse this sync core. */
type Client = SupabaseClient<Database>;

/** Provider literal recorded on `sync_runs.provider` + `error_events.provider`. */
const SYNC_PROVIDER = "x" as const;

/** Refresh the access token this many ms BEFORE its recorded expiry. */
const REFRESH_SKEW_MS = 60_000;

/** Result of a sync attempt. */
export interface SyncXResult {
  ok: boolean;
  status: "ok" | "partial" | "expired" | "error";
  synced: number;
}

/** Human-readable message for a `refreshTokens` failure. */
function refreshErrorMessage(err: unknown): string {
  return err instanceof Error ? `Token refresh failed: ${err.message}` : "Token refresh failed";
}

/**
 * Sync the user's X follower count into `social_followers` (`platform='X'`,
 * `source='api'`).
 *
 * Caller supplies the Supabase client — this function NEVER creates one. The
 * admin/cron client bypasses RLS, so every read and write is explicitly scoped
 * by `user_id`.
 *
 * One UTC day-key per row (`todayISO()`). Per the "API overwrites" decision the
 * cron silently replaces any same-day manual X figure (mirrors the manual
 * `logFollowers` upsert; differs ONLY in `source:'api'`). It touches ONLY the
 * `platform='X'` row — never LINKEDIN/SUBSTACK/GITHUB/IG.
 */
export async function syncX(client: Client, userId: string): Promise<SyncXResult> {
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
  //    `metadata.expires_at` is epoch MILLISECONDS (`Date.now() + expires_in*1000`).
  //    Refresh if already past or within the skew window of now. This runs ~daily:
  //    X access tokens are short-lived (~2h), so the overnight gap almost always
  //    expires them.
  const metadata = (integration.metadata ?? {}) as Record<string, unknown>;
  const expiresAt = Number(metadata.expires_at ?? 0);
  if (expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    // Guard the refresh token FIRST — X ROTATES single-use refresh tokens.
    // With no refresh token the connection is permanently bricked.
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

    // WRITE-BEFORE-USE: X invalidated the old refresh token the moment we called
    // refreshTokens. Persist the new rotated pair BEFORE using the new access
    // token. A failed persist here would permanently brick the connection (old
    // token dead, new one unpersisted).
    await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
    token = refreshed.accessToken;
    rt = refreshed.refreshToken;
  }

  // 4. Single read → single scalar → single upsert (or skip).
  //    On a mid-fetch 401, refresh once (write-before-use) and retry; a second
  //    401 propagates. Any non-401 error is a DATA hiccup: log it, keep
  //    status:'connected', write a `partial` run, return {ok:false}.
  let raw: unknown;
  let refreshedFor401 = false;

  try {
    try {
      raw = await getMe(token);
    } catch (err) {
      // Mid-fetch 401 → refresh once (write-before-use), then retry.
      if (err instanceof XApiError && err.status === 401 && !refreshedFor401) {
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

        // Write-before-use (same pattern as the proactive refresh).
        await persistRefreshedTokens(client, userId, SYNC_PROVIDER, refreshed);
        token = refreshed.accessToken;
        rt = refreshed.refreshToken;

        // Retry with the new token. A second 401 falls through to the catch
        // below and is handled as a data hiccup (it propagates, not refreshed).
        raw = await getMe(token);
      } else {
        // Non-401 error or second 401 — treat as a data hiccup.
        throw err;
      }
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
        context: { stage: "syncXFollowers" },
      });
    } catch {
      // best-effort — swallow logging failure
    }
    await writeSyncRun(client, userId, startedAt, 0, "partial", message);
    return { ok: false, status: "partial", synced: 0 };
  }

  // 5. One scalar. Pass `getMe`'s result STRAIGHT into `mapFollowerCount` — the
  //    shape contract is owned entirely by the mapper (never reach into `.data`).
  const count = mapFollowerCount(raw);

  // 5a. Malformed/empty/non-numeric read → mapFollowerCount returned null.
  //     KEEP status:'connected', log an error_events row, write a `partial` run,
  //     and DO NOT write social_followers (never clobber a good prior count).
  //     A data hiccup must NOT flip to `expired`.
  if (count === null) {
    const message = "X follower count missing or malformed in /2/users/me response";
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: SYNC_PROVIDER,
        severity: "error",
        message,
        context: { stage: "syncXFollowers" },
      });
    } catch {
      // best-effort — swallow logging failure
    }
    await writeSyncRun(client, userId, startedAt, 0, "partial", message);
    return { ok: false, status: "partial", synced: 0 };
  }

  // 5b. Valid count (including 0) → single upsert. Mirrors the manual
  //     `logFollowers` upsert, differing ONLY in `source:'api'`. Touches ONLY
  //     the `platform='X'` row; the cron silently replaces any same-day manual
  //     X figure (the "API overwrites" decision). Date key is the UTC day.
  try {
    const { error } = await client.from("social_followers").upsert(
      { user_id: userId, platform: "X", date: todayISO(), count, source: "api" },
      { onConflict: "user_id,platform,date" },
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    // DATA hiccup on the write — keep status:'connected', record + `partial`.
    const message = err instanceof Error ? err.message : String(err);
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: SYNC_PROVIDER,
        severity: "error",
        message,
        context: { stage: "syncXFollowers" },
      });
    } catch {
      // best-effort — swallow logging failure
    }
    await writeSyncRun(client, userId, startedAt, 0, "partial", message);
    return { ok: false, status: "partial", synced: 0 };
  }

  // 6. Success.
  await touchLastSyncedFor(client, userId, SYNC_PROVIDER);
  await writeSyncRun(client, userId, startedAt, 1, "ok");

  return { ok: true, status: "ok", synced: 1 };
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
