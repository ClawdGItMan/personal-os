/**
 * Typed server-environment accessors.
 *
 * IMPORTANT: `requireEnv` and every getter below read `process.env` at
 * CALL TIME (inside a function body), never at module top-level. This keeps
 * `pnpm build` from throwing when an env var is absent in the build
 * environment — the throw only happens when a code path actually needs the
 * value at runtime.
 *
 * Public (`NEXT_PUBLIC_*`) vars are inlined by Next.js at build time and are
 * safe to expose to the client; the rest are server-only secrets.
 */

/** Returns the value of `name` or throws a clear error if it is unset/empty. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGoogleClientId(): string {
  return requireEnv("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret(): string {
  return requireEnv("GOOGLE_CLIENT_SECRET");
}

export function getGoogleOauthRedirectUri(): string {
  return requireEnv("GOOGLE_OAUTH_REDIRECT_URI");
}

export function getWhoopClientId(): string {
  return requireEnv("WHOOP_CLIENT_ID");
}

export function getWhoopClientSecret(): string {
  return requireEnv("WHOOP_CLIENT_SECRET");
}

export function getWhoopOauthRedirectUri(): string {
  return requireEnv("WHOOP_OAUTH_REDIRECT_URI");
}

export function getCronSecret(): string {
  return requireEnv("CRON_SECRET");
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSiteUrl(): string {
  return requireEnv("NEXT_PUBLIC_SITE_URL");
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}
