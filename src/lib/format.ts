export function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtUSDDelta(n: number): string {
  const s = fmtUSD(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function fmtClock(d: Date): { hh: string; mm: string; ss: string } {
  return {
    hh: String(d.getHours()).padStart(2, "0"),
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
  };
}

export function fmtDate(d: Date): string {
  return d
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

/** Today as an ISO date string (YYYY-MM-DD), used as the key for daily time-series rows. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Derive 2-letter initials from a name, e.g. "Max Allaire" -> "MA". */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MA";
  if (parts.length === 1) return (parts[0] ?? "M").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/** ISO date (YYYY-MM-DD) for `days` days before today — for time-series query windows.
 *  Lives here (module scope, not a component) so the impure `Date.now()` is allowed. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
