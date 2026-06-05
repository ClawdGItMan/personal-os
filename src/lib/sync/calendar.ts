import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getGoogleIntegration,
  markStatus,
  persistRefreshedTokens,
  readTokens,
  touchLastSynced,
} from "@/lib/integrations/store";
import {
  fetchEvents,
  GoogleCalendarError,
  mapEvent,
  type FetchEventsWindow,
} from "@/lib/google/calendar";
import { GoogleAuthError, refreshAccessToken } from "@/lib/google/oauth";

/** Shared client type — satisfied by both the cookie client (`@/lib/supabase/server`)
 * and the service-role admin client (`@/lib/supabase/admin`), so both the inline
 * backfill (callback) and the cron path reuse this sync core. */
type Client = SupabaseClient<Database>;

/** Provider literal recorded on `calendar_events`, `sync_runs`, and `error_events`. */
const SYNC_PROVIDER = "google_calendar" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Result of a sync attempt. `synced` is the number of upserted event rows. */
export interface SyncCalendarResult {
  ok: boolean;
  synced: number;
  status: "ok" | "expired" | "error";
}

/**
 * Sync the user's Google Calendar into `calendar_events`.
 *
 * Caller supplies the Supabase client (cookie client for the inline backfill,
 * service-role admin client for cron) — this function never creates one. The
 * client is RLS-trusted to act on `userId`; every write is explicitly scoped by
 * `user_id` regardless (the admin client bypasses RLS).
 *
 * Window: incremental syncs (when `last_synced_at` is set) look at `[now, now+7d]`;
 * the first sync (no `last_synced_at`) backfills `[now-7d, now+30d]`.
 *
 * On a 401 from the Calendar API the access token is refreshed once, persisted,
 * and the fetch retried. If the refresh itself fails, the integration is marked
 * `expired`, a `failed` sync_run is recorded, and the function returns without
 * throwing. Any other thrown error records an `error_events` row + marks the
 * integration `error`.
 */
export async function syncCalendar(
  client: Client,
  userId: string,
): Promise<SyncCalendarResult> {
  const startedAt = new Date().toISOString();

  try {
    const integration = await getGoogleIntegration(client, userId);
    if (!integration) {
      return { ok: false, synced: 0, status: "error" };
    }

    const { accessToken, refreshToken } = readTokens(integration);
    if (!accessToken) {
      // No usable token — treat like an expired connection so the user reconnects.
      await markStatus(client, userId, "expired", "Missing access token");
      await writeSyncRun(client, userId, startedAt, 0, "failed", "Missing access token");
      return { ok: false, synced: 0, status: "expired" };
    }

    const now = Date.now();
    const window: FetchEventsWindow = integration.last_synced_at
      ? {
          timeMin: new Date(now).toISOString(),
          timeMax: new Date(now + 7 * DAY_MS).toISOString(),
        }
      : {
          timeMin: new Date(now - 7 * DAY_MS).toISOString(),
          timeMax: new Date(now + 30 * DAY_MS).toISOString(),
        };

    // Fetch events; on a 401 refresh the access token once and retry.
    let rawEvents;
    try {
      rawEvents = await fetchEvents(accessToken, window);
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.status === 401 && refreshToken) {
        let refreshed;
        try {
          refreshed = await refreshAccessToken(refreshToken);
        } catch (refreshErr) {
          const msg =
            refreshErr instanceof GoogleAuthError
              ? `Token refresh failed: ${refreshErr.status}`
              : refreshErr instanceof Error
                ? refreshErr.message
                : "Token refresh failed";
          await markStatus(client, userId, "expired", msg);
          await writeSyncRun(client, userId, startedAt, 0, "failed", msg);
          return { ok: false, synced: 0, status: "expired" };
        }

        // Persist the rotated access token (refresh tokens are not rotated by
        // Google), preserving status/refresh_token/metadata, then retry once.
        await persistAccessToken(client, userId, refreshed.accessToken, refreshed.expiresAt);
        rawEvents = await fetchEvents(refreshed.accessToken, window);
      } else {
        throw err;
      }
    }

    const rows = rawEvents
      .map((event) => mapEvent(event))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((row) => ({ ...row, user_id: userId }));

    if (rows.length > 0) {
      const { error } = await client
        .from("calendar_events")
        .upsert(rows, { onConflict: "user_id,source,external_id" });
      if (error) throw new Error(error.message);
    }

    await touchLastSynced(client, userId);
    await writeSyncRun(client, userId, startedAt, rows.length, "ok");

    return { ok: true, synced: rows.length, status: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best-effort error logging — never let logging failures mask the original.
    try {
      await client.from("error_events").insert({
        user_id: userId,
        provider: SYNC_PROVIDER,
        severity: "error",
        message,
        context: { stage: "syncCalendar" },
      });
    } catch {
      // swallow
    }
    try {
      await markStatus(client, userId, "error", message);
    } catch {
      // swallow
    }
    return { ok: false, synced: 0, status: "error" };
  }
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

/**
 * Persist a refreshed access token in place, keeping the existing refresh token
 * and status. Encrypts the new access token; updates `metadata.expires_at`.
 */
async function persistAccessToken(
  client: Client,
  userId: string,
  accessToken: string,
  expiresAt: number,
): Promise<void> {
  // Google does NOT rotate refresh tokens — omit refreshToken. persistRefreshedTokens
  // reads the current row to MERGE metadata (fixes the prior clobber that replaced it).
  await persistRefreshedTokens(client, userId, "google", { accessToken, expiresAt });
}
