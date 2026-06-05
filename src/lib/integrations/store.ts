import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

/** Shared client type — satisfied by both the cookie client (`@/lib/supabase/server`)
 * and the service-role admin client (`@/lib/supabase/admin`), so user and cron paths reuse this store. */
type Client = SupabaseClient<Database>;

type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];

/** The only provider this store handles for 1B.1a. Gmail (1B.1b) reuses the same shape. */
export const GOOGLE_PROVIDER = "google" as const;

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry as epoch milliseconds. */
  expiresAt: number;
};

/** Fetch the Google integration row for a user (RLS-scoped via `user_id`). Returns null when absent. */
export async function getGoogleIntegration(
  client: Client,
  userId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await client
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Encrypt + persist Google tokens, marking the integration `connected`.
 * Upserts on `(user_id, provider)` so reconnects overwrite in place. */
export async function saveGoogleTokens(
  client: Client,
  userId: string,
  tokens: GoogleTokens,
): Promise<void> {
  const { error } = await client.from("integrations").upsert(
    {
      user_id: userId,
      provider: GOOGLE_PROVIDER,
      access_token: encryptToken(tokens.accessToken),
      refresh_token: encryptToken(tokens.refreshToken),
      status: "connected",
      last_error: null,
      metadata: { expires_at: tokens.expiresAt },
    },
    { onConflict: "user_id,provider" },
  );
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
export async function markStatus(
  client: Client,
  userId: string,
  status: string,
  lastError?: string,
): Promise<void> {
  const { error } = await client
    .from("integrations")
    .update({ status, last_error: lastError ?? null })
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER);
  if (error) throw new Error(error.message);
}

/** Stamp `last_synced_at` to now after a successful sync. */
export async function touchLastSynced(client: Client, userId: string): Promise<void> {
  const { error } = await client
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER);
  if (error) throw new Error(error.message);
}
