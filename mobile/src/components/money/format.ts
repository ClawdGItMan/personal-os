/**
 * Money-local formatting helpers (design README §Money). Kept local to this
 * folder (not `lib/format.ts`, which other Wave-B screens are editing
 * concurrently) — only `time12` is imported read-only from there.
 *
 * Three currency shapes per the design brief:
 *  - compact hero/group figures: "$2.83M" / "$412K" / "$8.4K"
 *  - plain ledger figures: "$1,842" / "$7.40" (cents only when non-zero)
 *  - signed ledger figures: "+$12,500" / "-$7.40"
 */
import { time12 } from "../../lib/format";

const SHORT_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Comma-group an unsigned integer string, e.g. "1842" -> "1,842". */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Compact magnitude: >= $1M -> "$X.XXM" (always 2 decimals); >= $1K ->
 * "$XK"/"$X.XK" (1 decimal below $100K so small-K figures like burn keep
 * precision, 0 decimals at/above $100K to match group-total precedent);
 * below $1K -> plain grouped dollars, no decimals.
 *
 * Tier boundaries are checked against the *post-rounding* magnitude, not the
 * raw one, so a value that rounds up into the next tier renders in that
 * tier's format rather than producing a mixed-precision artifact:
 *  - $999,500 -> "$1.00M", not "$1000K" (raw abs is < $1M, but the 2-decimal
 *    M rendering of it already rounds to 1.00).
 *  - $99,950 -> "$100K", not "$100.0K" (raw abs is < $100K, but the 1-decimal
 *    K rendering of it already rounds to 100.0, which belongs in the
 *    0-decimal >=$100K tier).
 */
export function formatCompactMagnitude(n: number): string {
  const abs = Math.abs(n);

  const roundedM = Math.round((abs / 1_000_000) * 100) / 100;
  if (abs >= 1_000_000 || roundedM >= 1) {
    return `$${roundedM.toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    const k = abs / 1_000;
    const roundedK1 = Math.round(k * 10) / 10;
    if (k >= 100 || roundedK1 >= 100) {
      return `$${Math.round(k)}K`;
    }
    return `$${roundedK1.toFixed(1)}K`;
  }

  return `$${groupThousands(String(Math.round(abs)))}`;
}

/** Compact currency with a leading "-" for negative values (DEBT group total). */
export function formatCompact(n: number): string {
  return `${n < 0 ? "-" : ""}${formatCompactMagnitude(n)}`;
}

/** Plain grouped dollars, cents shown only when non-zero, e.g. "$1,842" / "$7.40". */
export function formatPlainMagnitude(n: number): string {
  const abs = Math.abs(n);
  const whole = Math.floor(abs + 1e-9);
  const cents = Math.round((abs - whole) * 100);
  const wholeStr = groupThousands(String(whole));
  return cents === 0 ? `$${wholeStr}` : `$${wholeStr}.${String(cents).padStart(2, "0")}`;
}

/** Plain grouped dollars with an explicit +/- sign (RECENT ledger rows). */
export function formatPlainSigned(n: number): string {
  return `${n < 0 ? "-" : "+"}${formatPlainMagnitude(n)}`;
}

/**
 * Ledger row date label — today reads a 12h clock time, yesterday reads
 * "YDA" (muted per design README §Money — ink34 vs ink50), anything older
 * reads "MON D" (also muted; the RECENT band was only ever specced for
 * today/yesterday, but `recent` isn't date-filtered so older rows need a
 * label too).
 */
export function ledgerDateLabel(iso: string): { label: string; muted: boolean } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: "", muted: false };
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return { label: time12(d), muted: false };
  if (diffDays === 1) return { label: "YDA", muted: true };
  return { label: `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`, muted: true };
}

/** Full date + time for the TransactionSheet detail view, e.g. "JUL 8 · 9:15 AM". */
export function fullDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()} · ${time12(d)}`;
}

/** Eyebrow-right runway label, rounded to whole months; null -> "RUNWAY —". */
export function runwayLabel(months: number | null): string {
  if (months == null) return "RUNWAY —";
  return `RUNWAY ${Math.round(months)} MO`;
}

/** Current month's short label for the burn band, e.g. "JUL BURN" — the
 * design mock hardcoded "MAY BURN"; this is data-driven so the label doesn't
 * go stale as the calendar month rolls over. */
export function monthAbbrev(d: Date = new Date()): string {
  return SHORT_MONTHS[d.getMonth()];
}
