import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

/** Shared client type — satisfied by both the cookie client (`@/lib/supabase/server`)
 * and the service-role admin client (`@/lib/supabase/admin`), so user and cron paths reuse this store. */
type Client = SupabaseClient<Database>;

type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
type IntegrationInsert = Database["public"]["Tables"]["integrations"]["Insert"];
type IntegrationUpdate = Database["public"]["Tables"]["integrations"]["Update"];

/** The Google provider literal. Gmail (1B.1b) reuses the same shape. */
export const GOOGLE_PROVIDER = "google" as const;

/** Providers this store handles. Whoop rotates refresh tokens + stores extra metadata. */
export type Provider = "google" | "whoop";

export type ProviderTokens = {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry as epoch milliseconds. */
  expiresAt: number;
};

/** Back-compat alias (no existing call site imports this by name). */
export type GoogleTokens = ProviderTokens;

/** Pure: builds the INSERT/UPSERT payload for saving tokens. MUST keep status + last_error:null. */
export function buildSaveUpsert(
  userId: string,
  provider: Provider,
  tokens: ProviderTokens,
  extraMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    user_id: userId,
    provider,
    access_token: encryptToken(tokens.accessToken),
    refresh_token: encryptToken(tokens.refreshToken),
    status: "connected",
    last_error: null, // clears any stale error on (re)connect — preserves the live saveGoogleTokens behavior
    metadata: { ...extraMetadata, expires_at: tokens.expiresAt }, // authoritative expires_at always wins
  };
}

/** Pure: builds the UPDATE payload for a refreshed token, merging metadata. */
export function buildRefreshUpdate(
  currentMetadata: Record<string, unknown> | null | undefined,
  refreshed: { accessToken: string; refreshToken?: string; expiresAt: number },
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    access_token: encryptToken(refreshed.accessToken),
    metadata: { ...(currentMetadata ?? {}), expires_at: refreshed.expiresAt },
  };
  if (refreshed.refreshToken) update.refresh_token = encryptToken(refreshed.refreshToken);
  return update;
}

/** Fetch a provider's integration row for a user (RLS-scoped via `user_id`). Returns null when absent. */
export async function getIntegration(
  client: Client,
  userId: string,
  provider: Provider,
): Promise<IntegrationRow | null> {
  const { data, error } = await client
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Encrypt + persist provider tokens, marking the integration `connected`.
 * Upserts on `(user_id, provider)` so reconnects overwrite in place. */
export async function saveTokens(
  client: Client,
  userId: string,
  provider: Provider,
  tokens: ProviderTokens,
  extraMetadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await client
    .from("integrations")
    .upsert(buildSaveUpsert(userId, provider, tokens, extraMetadata) as IntegrationInsert, {
      onConflict: "user_id,provider",
    });
  if (error) throw new Error(error.message);
}

/** Persist refreshed tokens in place; reads current row to MERGE metadata.
 *  Pass refreshToken ONLY for providers that rotate it (Whoop); omit for Google. */
export async function persistRefreshedTokens(
  client: Client,
  userId: string,
  provider: Provider,
  refreshed: { accessToken: string; refreshToken?: string; expiresAt: number },
): Promise<void> {
  const current = await getIntegration(client, userId, provider);
  const update = buildRefreshUpdate(current?.metadata as Record<string, unknown> | undefined, refreshed);
  const { error } = await client
    .from("integrations")
    .update(update as IntegrationUpdate)
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

/** Decrypt the stored ciphertext tokens off an integration row.
 * Accepts either a full row or just its token columns. Null columns pass through as null. */
export function readTokens(
  row: Pick<IntegrationRow, "access_token" | "refresh_token">,
): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: row.access_token ? decryptToken(row.access_token) : null,
    refreshToken: row.refresh_token ? decryptToken(row.refresh_token) : null,
  };
}

/** Update connection status (e.g. `expired`, `error`), recording an optional last error message. */
export async function markStatusFor(
  client: Client,
  userId: string,
  provider: Provider,
  status: string,
  lastError?: string,
): Promise<void> {
  const { error } = await client
    .from("integrations")
    .update({ status, last_error: lastError ?? null })
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

/** Stamp `last_synced_at` to now after a successful sync. */
export async function touchLastSyncedFor(
  client: Client,
  userId: string,
  provider: Provider,
): Promise<void> {
  const { error } = await client
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

// --- Backwards-compatible Google wrappers (identical signatures to today) ---

/** Fetch the Google integration row for a user (RLS-scoped via `user_id`). Returns null when absent. */
export async function getGoogleIntegration(client: Client, userId: string) {
  return getIntegration(client, userId, "google");
}

/** Encrypt + persist Google tokens, marking the integration `connected`. */
export async function saveGoogleTokens(client: Client, userId: string, tokens: ProviderTokens) {
  return saveTokens(client, userId, "google", tokens);
}

/** Update Google connection status, recording an optional last error message. */
export async function markStatus(client: Client, userId: string, status: string, lastError?: string) {
  return markStatusFor(client, userId, "google", status, lastError);
}

/** Stamp `last_synced_at` to now after a successful Google sync. */
export async function touchLastSynced(client: Client, userId: string) {
  return touchLastSyncedFor(client, userId, "google");
}
