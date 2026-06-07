import "server-only";

import {
  getWhoopClientId,
  getWhoopClientSecret,
  getWhoopOauthRedirectUri,
} from "@/lib/env";

/**
 * Whoop OAuth 2.0 authorization-code flow helpers.
 *
 * Docs (verified 2026-06-05): https://developer.whoop.com
 *
 * - Auth endpoint:  https://api.prod.whoop.com/oauth/oauth2/auth
 * - Token endpoint: https://api.prod.whoop.com/oauth/oauth2/token (POST, x-www-form-urlencoded)
 *
 * `expiresAt` is computed from the response `expires_in` (seconds) relative to
 * the current time, expressed as epoch milliseconds (`Date.now() + expires_in*1000`).
 *
 * Key difference from Google: Whoop ROTATES the refresh token. Every refresh
 * returns a NEW single-use `refresh_token` and invalidates the one just used,
 * so `refreshTokens` returns and the caller MUST persist the new refresh token.
 */

const WHOOP_AUTH_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/token";

/**
 * Scopes requested at consent (space-joined in the consent URL).
 *
 * Note: `read:cycles` is plural, `read:workout` is singular, and `offline`
 * is the bare string (not `offline_access`). `offline` MUST be present to
 * receive a refresh token at all, and re-sent on every refresh to keep
 * receiving a rotated one.
 */
export const WHOOP_SCOPES = [
  "read:recovery",
  "read:sleep",
  "read:cycles",
  "read:workout",
  "read:profile",
  "offline",
] as const;

/** Typed error thrown when a Whoop OAuth token request returns a non-200. */
export class WhoopAuthError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "WhoopAuthError";
    this.status = status;
    this.body = body;
  }
}

/** Shape returned by Whoop's token endpoint (flat, top-level; subset we use). */
interface WhoopTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/**
 * Build the Whoop consent-screen URL for the authorization-code flow.
 *
 * `state` is an opaque CSRF token the caller stores (e.g. in a short-lived
 * httpOnly cookie) and verifies on callback. Whoop requires `state` ≥ 8 chars
 * (our 32-hex token satisfies this).
 */
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getWhoopClientId(),
    redirect_uri: getWhoopOauthRedirectUri(),
    response_type: "code",
    scope: WHOOP_SCOPES.join(" "),
    state,
  });
  return `${WHOOP_AUTH_ENDPOINT}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<WhoopTokenResponse> {
  const response = await fetch(WHOOP_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new WhoopAuthError(
      `Whoop token request failed with status ${response.status}`,
      response.status,
      text,
    );
  }

  return JSON.parse(text) as WhoopTokenResponse;
}

/**
 * Exchange an authorization code for tokens.
 *
 * @returns `accessToken`, `refreshToken`, and `expiresAt` (epoch ms).
 * @throws {WhoopAuthError} on a non-200 response, or if no refresh token is
 *   returned (we requested `offline`, so its absence means re-consent).
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getWhoopOauthRedirectUri(),
      client_id: getWhoopClientId(),
      client_secret: getWhoopClientSecret(),
    }),
  );

  // We request the `offline` scope, so a fresh grant should always include a
  // refresh token. If Whoop omits it, fail loudly rather than persist an empty
  // refresh token (which would silently break the later refresh path).
  if (!data.refresh_token) {
    throw new WhoopAuthError(
      "Whoop did not return a refresh token (re-consent required)",
      400,
      "missing refresh_token",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Whoop ROTATES refresh tokens: the token just used is invalidated and a NEW
 * `refresh_token` is returned, so we return it and the caller MUST persist it.
 * `scope=offline` MUST be re-sent on every refresh or Whoop will not return a
 * rotated refresh token.
 *
 * @returns `accessToken`, the rotated `refreshToken`, and `expiresAt` (epoch ms).
 * @throws {WhoopAuthError} on a non-200 response, or if no rotated refresh token
 *   is returned. The just-used token is now invalidated, so persisting nothing
 *   would brick the connection — we fail loudly and callers mark it `expired`.
 */
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getWhoopClientId(),
      client_secret: getWhoopClientSecret(),
      scope: "offline",
    }),
  );

  if (!data.refresh_token) {
    throw new WhoopAuthError(
      "Whoop did not return a rotated refresh token on refresh",
      400,
      "missing refresh_token",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
