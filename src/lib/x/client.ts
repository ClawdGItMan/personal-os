/**
 * X (Twitter) v2 REST client — a thin HTTP layer over the X API.
 *
 * Docs (verified 2026-06-08): https://docs.x.com/x-api/users/get-my-user
 * Base: https://api.x.com/2/
 *
 * This module never touches Supabase or tokens directly: callers (the sync
 * core) supply a valid user access token and persist the results. It mirrors
 * the fetch + typed-error pattern in `src/lib/whoop/client.ts`.
 *
 * Unlike Whoop, there is NO pagination here: the only endpoint we call,
 * `/2/users/me`, returns a single object, not a paged collection.
 */

const X_API_BASE = "https://api.x.com/2/";

/** Error carrying the HTTP status so the sync core can branch on 401. */
export class XApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "XApiError";
    this.status = status;
  }
}

/** Query params: string or number values — undefined entries are skipped. */
export type XParams = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: XParams): string {
  // `path` is relative to the v2 base, e.g. "users/me". Strip any leading slash
  // so it resolves against the base rather than the origin root.
  const url = new URL(path.replace(/^\/+/, ""), X_API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Performs a single authenticated GET against the X v2 API and returns the
 * parsed JSON.
 *
 * @throws {XApiError} on a non-OK HTTP response. The upstream body is truncated
 *   to ~200 chars (it can land in user-facing error fields, so keep it short),
 *   and the status is carried so the sync core can branch on 401.
 */
export async function xFetch<T = unknown>(
  accessToken: string,
  path: string,
  params?: XParams,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new XApiError(
      `X ${path} failed: ${res.status} ${res.statusText} ${body}`.trim(),
      res.status,
    );
  }

  return (await res.json()) as T;
}

/**
 * Fetch the authenticated user, including `public_metrics` (which carries
 * `followers_count`). Returns the raw parsed JSON — the pure mapper
 * (`mapFollowerCount` in `./social`) owns the shape contract, so the return is
 * typed loosely as `unknown`.
 *
 * No pagination: `/2/users/me` is a single object.
 */
export async function getMe(accessToken: string): Promise<unknown> {
  return xFetch(accessToken, "users/me", {
    "user.fields": "public_metrics",
  });
}
