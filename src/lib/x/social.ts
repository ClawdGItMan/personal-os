/**
 * Pure mapper for the X (Twitter) follower count.
 *
 * Docs (verified 2026-06-08): https://docs.x.com/x-api/users/get-my-user
 * The `GET /2/users/me?user.fields=public_metrics` response carries the count at
 * `data.public_metrics.followers_count` (siblings: `following_count`,
 * `tweet_count`, `listed_count`).
 *
 * This is a pure scalar extractor — no `user_id`/`platform`/`source`/`date`.
 * The sync core builds the `social_followers` row around the returned number.
 *
 * Contract: returns the count ONLY if it is a finite, non-negative integer.
 * `0` is a VALID count and returns `0` (NOT null). Anything missing, the wrong
 * type, NaN, or negative returns `null`, which signals the sync core to SKIP
 * the write so a transient bad response never clobbers a good stored value.
 */

/** Minimal shape we read from the `/2/users/me` response. */
interface UsersMeResponse {
  data?: {
    public_metrics?: {
      followers_count?: unknown;
    };
  };
}

/**
 * Extract `followers_count` from a `/2/users/me` response.
 *
 * @returns the count when it is a finite, non-negative integer (including `0`);
 *   otherwise `null` (skip the write — don't clobber the last good value).
 */
export function mapFollowerCount(raw: unknown): number | null {
  const count = (raw as UsersMeResponse | null | undefined)?.data
    ?.public_metrics?.followers_count;

  if (typeof count !== "number") return null;
  if (!Number.isInteger(count) || count < 0) return null;

  return count;
}
