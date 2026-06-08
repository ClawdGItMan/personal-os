import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  getXClientId,
  getXClientSecret,
  getXOauthRedirectUri,
} from "@/lib/env";

/**
 * X (Twitter) OAuth 2.0 Authorization-Code-with-PKCE flow helpers.
 *
 * Docs (verified 2026-06-08):
 * - https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
 * - https://docs.x.com/x-api/users/get-my-user
 *
 * - Auth endpoint:  https://x.com/i/oauth2/authorize
 * - Token endpoint: https://api.x.com/2/oauth2/token (POST, x-www-form-urlencoded)
 *
 * `expiresAt` is computed from the response `expires_in` (seconds) relative to
 * the current time, expressed as epoch milliseconds (`Date.now() + expires_in*1000`)
 * to match the token store's convention.
 *
 * Two things make X distinct from Whoop/Strava:
 *
 * 1. PKCE. The consent URL carries a `code_challenge` (S256 hash of a
 *    per-request `code_verifier`); the verifier is then replayed on the token
 *    exchange as cryptographic proof. The caller must persist the verifier
 *    alongside `state` between the consent redirect and the callback.
 *
 * 2. Confidential vs public client. If `X_CLIENT_SECRET` is set we authenticate
 *    the token request with an HTTP Basic header (confidential client); if it is
 *    absent we send `client_id` in the form body instead (public client). Both
 *    are valid X configurations — the secret's absence must NOT throw.
 *
 * Like Whoop and Strava, X ROTATES the refresh token: every refresh returns a
 * NEW single-use `refresh_token` and invalidates the one just used, so the
 * caller MUST persist the returned refresh token.
 */

const X_AUTH_ENDPOINT = "https://x.com/i/oauth2/authorize";
const X_TOKEN_ENDPOINT = "https://api.x.com/2/oauth2/token";

/**
 * Scopes requested at consent (space-joined in the consent URL).
 *
 * Read-only: `tweet.read` + `users.read` are the minimum to read the
 * authenticated user's public metrics. `offline.access` is MANDATORY to be
 * issued a refresh token at all, and must be re-sent on every refresh to keep
 * receiving a rotated one.
 */
export const X_SCOPES = ["tweet.read", "users.read", "offline.access"] as const;

/** Typed error thrown when an X OAuth token request returns a non-200. */
export class XAuthError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "XAuthError";
    this.status = status;
    // Truncate: this body can surface in user-facing error fields, and must
    // never carry a full token-bearing payload around. NEVER log tokens.
    this.body = body.slice(0, 200);
  }
}

/** Shape returned by X's token endpoint (flat, top-level; subset we use). */
interface XTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/** Encode a Buffer as base64url (RFC 7636): `+`→`-`, `/`→`_`, strip `=` padding. */
function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a PKCE verifier/challenge pair (S256).
 *
 * The `verifier` is a high-entropy URL-safe random string (32 bytes → 43-char
 * base64url, within RFC 7636's 43–128 range). The `challenge` is the base64url
 * SHA-256 of the verifier. The caller persists the verifier between the consent
 * redirect and the callback, then passes it to {@link exchangeCode}.
 */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/**
 * Build the X consent-screen URL for the authorization-code-with-PKCE flow.
 *
 * `state` is an opaque CSRF token the caller stores (e.g. in a short-lived
 * httpOnly cookie) and verifies on callback. `codeChallenge` is the S256
 * challenge from {@link generatePkce}; its matching verifier must be persisted
 * for the token exchange.
 */
export function buildConsentUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getXClientId(),
    redirect_uri: getXOauthRedirectUri(),
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * POST to the token endpoint with the correct client authentication.
 *
 * Confidential client (secret present): send `Authorization: Basic
 * base64(clientId:clientSecret)` and DO NOT include `client_id` in the body.
 * Public client (secret absent): omit the Basic header and include `client_id`
 * in the form body. The caller passes grant-specific params; this helper layers
 * client auth on top. Never throws on a missing secret.
 */
async function postToken(params: URLSearchParams): Promise<XTokenResponse> {
  const clientId = getXClientId();
  const clientSecret = getXClientSecret();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    // Confidential client: HTTP Basic auth, no client_id in the body.
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  } else {
    // Public client: client_id is required in the form body instead.
    params.set("client_id", clientId);
  }

  const response = await fetch(X_TOKEN_ENDPOINT, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new XAuthError(
      `X token request failed with status ${response.status}`,
      response.status,
      text,
    );
  }

  return JSON.parse(text) as XTokenResponse;
}

/**
 * Exchange an authorization code for tokens.
 *
 * `codeVerifier` is the PKCE verifier that matches the `code_challenge` sent on
 * the consent URL — X verifies it as proof the same client started the flow.
 *
 * The token response does NOT carry the user's id/handle, so `xUserId` and
 * `username` are left undefined here; the callback fetches them via `getMe`.
 *
 * @returns `accessToken`, `refreshToken`, `expiresAt` (epoch ms), and optional
 *   `xUserId`/`username` (always undefined from this endpoint).
 * @throws {XAuthError} on a non-200 response, or if no refresh token is
 *   returned (we requested `offline.access`, so its absence means the scope was
 *   dropped at consent and re-consent is required).
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  xUserId?: string;
  username?: string;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getXOauthRedirectUri(),
      code_verifier: codeVerifier,
    }),
  );

  // We request `offline.access`, so a fresh grant should always include a
  // refresh token. If X omits it, fail loudly rather than persist an empty
  // refresh token (which would silently break the later refresh path).
  if (!data.refresh_token) {
    throw new XAuthError(
      "X did not return a refresh token (offline.access dropped — re-consent required)",
      400,
      "missing refresh_token",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    xUserId: undefined,
    username: undefined,
  };
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * X ROTATES refresh tokens (single-use): the token just used is invalidated and
 * a NEW `refresh_token` is returned, so we return it and the caller MUST persist
 * it immediately. `offline.access` is re-sent in `scope` to keep X issuing a
 * rotated refresh token.
 *
 * @returns `accessToken`, the rotated `refreshToken`, and `expiresAt` (epoch ms).
 * @throws {XAuthError} on a non-200 response, or if no rotated refresh token is
 *   returned. The just-used token is now dead, so persisting nothing would
 *   permanently brick the connection — we fail loudly and callers mark it `expired`.
 */
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  /** The NEW rotated refresh token — MUST be persisted immediately. */
  refreshToken: string;
  expiresAt: number;
}> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: X_SCOPES.join(" "),
    }),
  );

  // X rotates the refresh token on every refresh and invalidates the old one.
  // If the rotated token is absent, the connection is permanently bricked —
  // fail loudly rather than persist nothing.
  if (!data.refresh_token) {
    throw new XAuthError(
      "X did not return a rotated refresh token on refresh",
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
