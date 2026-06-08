/**
 * Strava v3 REST client — a thin HTTP layer over the Strava API.
 *
 * Docs (verified 2026-06-08): https://developers.strava.com/docs/reference/
 * Base: https://www.strava.com/api/v3/
 *
 * This module never touches Supabase or tokens directly: callers (the sync
 * core) supply a valid access token and persist the results. It mirrors the
 * fetch + typed-error pattern in `src/lib/whoop/client.ts`.
 *
 * Pagination asymmetry vs Whoop: Strava uses page-NUMBER pagination (1-based
 * `page` + `per_page`), not cursor tokens. The response is a bare JSON ARRAY
 * (not a `{ records, next_token }` envelope). Stop when a page returns fewer
 * than `per_page` items (last page). A MAX_PAGES cap prevents exhausting the
 * rate budget on a pathological backfill history.
 */

const STRAVA_API_BASE = "https://www.strava.com/api/v3/";

/**
 * Backfill cap: 5 pages × 100 items = 500 activities max.
 * Incremental syncs naturally land on page 1 (tiny window).
 */
const MAX_PAGES = 5;

/** Error carrying the HTTP status so the sync core can branch on 401. */
export class StravaApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StravaApiError";
    this.status = status;
  }
}

/** Query params: string or numeric values — we stringify before appending. */
export type StravaParams = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: StravaParams): string {
  // `path` is relative to the v3 base, e.g. "athlete/activities".
  // Strip any leading slash so it resolves correctly against the base URL.
  const url = new URL(path.replace(/^\/+/, ""), STRAVA_API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Performs a single authenticated GET against the Strava v3 API and returns
 * the parsed JSON.
 *
 * @throws {StravaApiError} on a non-OK HTTP response. The upstream body is
 *   truncated to ~200 chars (it lands in user-facing error fields, so keep it
 *   short), and the status is carried so the sync core can branch on 401.
 */
export async function stravaFetch<T = unknown>(
  accessToken: string,
  path: string,
  params?: StravaParams,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new StravaApiError(
      `Strava ${path} failed: ${res.status} ${res.statusText} ${body}`.trim(),
      res.status,
    );
  }

  return (await res.json()) as T;
}

/**
 * Fetches activities from Strava using page-number pagination, accumulating
 * results until a page returns fewer items than `per_page` (the last page)
 * OR `MAX_PAGES` is hit (backfill cap: 500 activities max).
 *
 * Note: `after`/`before` are epoch SECONDS (Strava convention), NOT the
 * epoch-millisecond `expires_at` stored in the token metadata. The sync core
 * is responsible for converting ms → seconds before calling this function.
 *
 * Strava's response for `GET /athlete/activities` is a BARE JSON ARRAY —
 * NOT a `{ records, next_token }` envelope like Whoop.
 */
export async function paginateActivities<T = unknown>(
  accessToken: string,
  params?: StravaParams,
): Promise<T[]> {
  const PER_PAGE = 100;
  const results: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageResults = await stravaFetch<T[]>(accessToken, "athlete/activities", {
      ...params,
      per_page: PER_PAGE,
      page,
    });

    if (pageResults.length > 0) {
      results.push(...pageResults);
    }

    // Stop when the page is not full — it's the last page.
    if (pageResults.length < PER_PAGE) {
      break;
    }

    // MAX_PAGES cap reached — stop to protect rate budget.
    // The next sync will continue from last_synced_at.
  }

  return results;
}
