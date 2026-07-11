/**
 * Pure formatting helpers for the Detail page (spec §5.5) — kept local to
 * `components/detail/**` since DetailScreen is the only consumer. Dates are
 * hand-rolled (not `toLocaleDateString`) for locale-stable output, matching
 * the convention already used by `theme/typeRoles.ts::eyebrowDate` and
 * `lib/format.ts::time12`.
 */

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local midnight of a date, as a comparable epoch ms. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "Today" / "Tomorrow" / "Yesterday" relative to the device's local day,
 * else "Wed, Jul 8". Returns "" for an unparseable ISO string (defensive —
 * callers should already guard on presence, this just never renders
 * "Invalid Date").
 */
export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffDays = Math.round((startOfLocalDay(d) - startOfLocalDay(new Date())) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Seconds → "H:MM" elapsed clock, e.g. 3900 → "1:05". */
export function formatDurationHM(totalSeconds: number): string {
  const totalMin = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** "high" → "High". Empty string passes through unchanged. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "google_calendar" → "Google Calendar" — humanizes a snake_case source/sport value. */
export function titleCaseFromSnake(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(" ");
}
