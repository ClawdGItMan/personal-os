/**
 * Whoop v2 REST client — a thin HTTP layer over the developer collections API.
 *
 * Docs (verified 2026-06-05): https://developer.whoop.com
 * Base: https://api.prod.whoop.com/developer/v2/
 *
 * This module never touches Supabase or tokens directly: callers (the sync
 * core) supply a valid access token and persist the results. It mirrors the
 * fetch + typed-error + pagination pattern in `src/lib/google/calendar.ts`.
 *
 * Pagination asymmetry (a real, easy-to-miss bug): the RESPONSE next-page field
 * is `next_token` (snake_case) but the REQUEST query param to send it back is
 * `nextToken` (camelCase).
 */

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2/";

/** Error carrying the HTTP status so the sync core can branch on 401. */
export class WhoopApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WhoopApiError";
    this.status = status;
  }
}

/** A Whoop collection response: a page of records + an optional next token. */
export interface WhoopPage<T> {
  records?: T[];
  next_token?: string;
}

/** Query params: string values, or arrays (e.g. repeated keys) — we stringify. */
export type WhoopParams = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: WhoopParams): string {
  // `path` is a collection path relative to the v2 base, e.g. "recovery" or
  // "activity/sleep". Strip any leading slash so it resolves against the base.
  const url = new URL(path.replace(/^\/+/, ""), WHOOP_API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Performs a single authenticated GET against a Whoop v2 collection and returns
 * the parsed JSON.
 *
 * @throws {WhoopApiError} on a non-OK HTTP response. The upstream body is
 *   truncated to ~200 chars (it lands in user-facing error fields, so keep it
 *   short), and the status is carried so the sync core can branch on 401.
 */
export async function whoopFetch<T = unknown>(
  accessToken: string,
  path: string,
  params?: WhoopParams,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new WhoopApiError(
      `Whoop ${path} failed: ${res.status} ${res.statusText} ${body}`.trim(),
      res.status,
    );
  }

  return (await res.json()) as T;
}

/**
 * Fetches every record in a Whoop collection, following pagination until the
 * server stops returning a `next_token`.
 *
 * Note the asymmetry: we read `next_token` off the response but send it back as
 * the `nextToken` request param.
 */
export async function paginate<T = unknown>(
  accessToken: string,
  path: string,
  params?: WhoopParams,
): Promise<T[]> {
  const records: T[] = [];
  let nextToken: string | undefined;

  do {
    const page = await whoopFetch<WhoopPage<T>>(accessToken, path, {
      ...params,
      ...(nextToken ? { nextToken } : {}),
    });
    if (page.records?.length) records.push(...page.records);
    nextToken = page.next_token;
  } while (nextToken);

  return records;
}
