/**
 * Freshness helpers for integration sync state. Module scope (not a component),
 * so the impure `Date.now()` is allowed (same convention as `format.isoDaysAgo`).
 */

const MINUTE_MS = 60_000;

/**
 * True when a sync is stale: either never run (`null`) or older than
 * `thresholdMin` minutes. Drives the `⚠ STALE` chip on data modules.
 */
export function isStale(lastSyncedAt: string | null, thresholdMin = 30): boolean {
  if (!lastSyncedAt) return true;
  const ts = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > thresholdMin * MINUTE_MS;
}

/** Compact age label, e.g. "5m", "3h", "2d"; "never" when no sync has run. */
export function staleAgeLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "never";
  const ts = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(ts)) return "never";

  const minutes = Math.max(0, Math.floor((Date.now() - ts) / MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
