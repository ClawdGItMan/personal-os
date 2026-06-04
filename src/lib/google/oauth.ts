import "server-only";

import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOauthRedirectUri,
} from "@/lib/env";

/**
 * Google OAuth 2.0 web-server flow helpers.
 *
 * Docs (verified 2026-06-03):
 * https://developers.google.com/identity/protocols/oauth2/web-server
 *
 * - Auth endpoint:  https://accounts.google.com/o/oauth2/v2/auth
 * - Token endpoint: https://oauth2.googleapis.com/token (POST, x-www-form-urlencoded)
 *
 * `expiresAt` is computed from the response `expires_in` (seconds) relative to
 * the current time, expressed as epoch milliseconds (`Date.now() + expires_in*1000`).
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * Scopes requested at consent. Calendar read-only only for 1B.1a;
 * `gmail.readonly` is appended in 1B.1b.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

/** Typed error thrown when a Google OAuth token request returns a non-200. */
export class GoogleAuthError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.status = status;
    this.body = body;
  }
}

/** Shape returned by Google's token endpoint (subset we use). */
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/**
 * Build the Google consent-screen URL for the authorization-code flow.
 *
 * `state` is an opaque CSRF token the caller stores (e.g. in a short-lived
 * httpOnly cookie) and verifies on callback.
 */
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleOauthRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new GoogleAuthError(
      `Google token request failed with status ${response.status}`,
      response.status,
      text,
    );
  }

  return JSON.parse(text) as GoogleTokenResponse;
}

/**
 * Exchange an authorization code for tokens.
 *
 * @returns `accessToken`, `refreshToken`, and `expiresAt` (epoch ms).
 * @throws {GoogleAuthError} on a non-200 response.
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleOauthRedirectUri(),
      grant_type: "authorization_code",
    }),
  );

  // `prompt=consent` + `access_type=offline` should always yield a refresh token
  // on a fresh grant. If Google omits it, fail loudly rather than persist an
  // empty refresh token (which would silently break the later refresh path and
  // mis-label the connection). The callback maps this to an `error` + reconsent.
  if (!data.refresh_token) {
    throw new GoogleAuthError(
      "Google did not return a refresh token (re-consent required)",
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
 * Google does not return a new `refresh_token` on refresh, so only the access
 * token and its expiry are returned.
 *
 * @returns `accessToken` and `expiresAt` (epoch ms).
 * @throws {GoogleAuthError} on a non-200 response (callers map to `expired`).
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      grant_type: "refresh_token",
    }),
  );

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
