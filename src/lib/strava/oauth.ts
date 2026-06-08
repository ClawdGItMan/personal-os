import "server-only";

import {
  getStravaClientId,
  getStravaClientSecret,
  getStravaOauthRedirectUri,
} from "@/lib/env";

/**
 * Strava OAuth 2.0 authorization-code flow helpers.
 *
 * Docs (verified 2026-06-08): https://developers.strava.com/docs/authentication/
 *
 * - Auth endpoint:  https://www.strava.com/oauth/authorize
 * - Token endpoint: https://www.strava.com/oauth/token (POST, x-www-form-urlencoded)
 *
 * `expiresAt` is computed from the response `expires_at` (epoch SECONDS) converted
 * to epoch milliseconds (`data.expires_at * 1000`) to match the store's convention.
 *
 * Key difference from Google: Strava ROTATES the refresh token. Every refresh
 * returns a NEW single-use `refresh_token` and invalidates the one just used,
 * so `refreshTokens` returns and the caller MUST persist the new refresh token.
 */

const STRAVA_AUTH_ENDPOINT = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_ENDPOINT = "https://www.strava.com/oauth/token";

/**
 * Scopes requested at consent (COMMA-joined in the consent URL — Strava uses
 * commas, not spaces like Whoop/Google).
 *
 * `activity:read_all` (not `activity:read`) so "Only You" / privacy-zone
 * activities are included for a personal dashboard.
 */
const STRAVA_SCOPES = ["activity:read_all"] as const;

/** Typed error thrown when a Strava OAuth token request returns a non-200. */
export class StravaAuthError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "StravaAuthError";
    this.status = status;
    this.body = body;
  }
}

/** Shape returned by Strava's token endpoint (subset we use). */
interface StravaTokenResponse {
  access_token: string;
  /** Epoch SECONDS — must convert ×1000 to get epoch ms for the store. */
  expires_at: number;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
  athlete?: { id?: number };
}

/**
 * Build the Strava consent-screen URL for the authorization-code flow.
 *
 * `state` is an opaque CSRF token the caller stores (e.g. in a short-lived
 * httpOnly cookie) and verifies on callback.
 *
 * `approval_prompt=force` ensures a fresh grant is issued on reconnect so a
 * rotated refresh token is always reissued.
 *
 * Scopes are COMMA-delimited (Strava convention — distinct from Whoop/Google
 * space-delimited).
 */
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getStravaClientId(),
    redirect_uri: getStravaOauthRedirectUri(),
    response_type: "code",
    scope: STRAVA_SCOPES.join(","),
    approval_prompt: "force",
    state,
  });
  return `${STRAVA_AUTH_ENDPOINT}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new StravaAuthError(
      `Strava token request failed with status ${response.status}`,
      response.status,
      text,
    );
  }

  return JSON.parse(text) as StravaTokenResponse;
}

/**
 * Exchange an authorization code for tokens.
 *
 * @returns `accessToken`, `refreshToken`, `expiresAt` (epoch ms), and `athleteId`.
 * @throws {StravaAuthError} on a non-200 response, or if no refresh token is
 *   returned (its absence means re-consent is required).
 *
 * Note: Strava does NOT require `redirect_uri` on token exchange (verified
 * against live docs 2026-06-08) — omitted here intentionally.
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds — Strava's epoch-seconds `expires_at` converted ×1000. */
  expiresAt: number;
  athleteId: number | undefined;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
    }),
  );

  // A fresh authorization_code grant must always include a refresh token.
  // Fail loudly rather than persist an empty refresh token, which would
  // silently break the later refresh path.
  if (!data.refresh_token) {
    throw new StravaAuthError(
      "Strava did not return a refresh token (re-consent required)",
      400,
      "missing refresh_token",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Strava returns expires_at as epoch SECONDS — convert to ms for the store.
    expiresAt: data.expires_at * 1000,
    athleteId: data.athlete?.id,
  };
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Strava ROTATES refresh tokens: the token just used is invalidated and a NEW
 * `refresh_token` is returned, so we return it and the caller MUST persist it.
 *
 * @returns `accessToken`, the rotated `refreshToken`, and `expiresAt` (epoch ms).
 * @throws {StravaAuthError} on a non-200 response, or if no rotated refresh token
 *   is returned. The just-used token is now dead — persisting nothing would
 *   permanently brick the connection, so we fail loudly and callers mark it `expired`.
 */
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  /** The NEW rotated refresh token — MUST be persisted immediately. */
  refreshToken: string;
  /** Epoch milliseconds — Strava's epoch-seconds `expires_at` converted ×1000. */
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
    }),
  );

  // Strava rotates the refresh token on every refresh and invalidates the old one.
  // If the rotated token is absent, the connection is permanently bricked — fail loudly.
  if (!data.refresh_token) {
    throw new StravaAuthError(
      "Strava did not return a rotated refresh token on refresh",
      400,
      "missing refresh_token",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Strava returns expires_at as epoch SECONDS — convert to ms for the store.
    expiresAt: data.expires_at * 1000,
  };
}
