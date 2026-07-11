/**
 * Shared formatting helpers — all times in the system are 12-hour
 * (design README: "1:16 PM"), built by hand so output is locale-stable.
 */

/** Format a Date or ISO string as 12-hour time, e.g. "9:30 AM" / "1:16 PM". */
export function time12(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const h12 = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${h12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * Eyebrow date, e.g. "FRIDAY · MAY 8" (design README: weekday/date eyebrow
 * row shown on every screen). Shared by Home/Body/Focus/Money — hand-rolled
 * (not `toLocaleDateString`) so output is locale-stable across platforms.
 */
export function eyebrowDate(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
