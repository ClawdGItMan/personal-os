/**
 * Sample Money data — same content as the approved money.html mockup (spec §5.3).
 * Replaced by the live Plaid/Supabase provider backend when the data layer lands.
 */
import { color } from "../theme/tokens";

export type DeltaTone = "up" | "muted" | "held";

export type AllocationClass = {
  name: string;
  /** Bar/legend segment color — token reference, never raw hex at the call site. */
  swatch: string;
  /** 0–1 width of this segment in the stacked bar. */
  fraction: number;
  /** Right-side mono read-out, e.g. "$1.24M · 44%". */
  value: string;
};

export type Account = {
  name: string;
  /** Class sublabel, e.g. "EQUITIES" or "CASH · 4.4% APY". */
  sub: string;
  /** Mono tabular value, e.g. "$1,240,000". */
  value: string;
  /** Delta read-out — "1.2%" for up/muted, or the literal "held"/"flat" word. */
  delta: string;
  tone: DeltaTone;
};

export type RangeKey = "1W" | "1M" | "3M" | "1Y" | "ALL";

export const moneyData = {
  recoveryPct: 0.72,
  eyebrow: "Money · Friday, May 8",
  title: { lead: "Up 8.9%", emphasis: "this month." },
  netWorth: {
    meta: "NET WORTH · PLAID",
    value: "$2,828,350",
    delta: "+$230,350 · +8.87% · 30D",
  },
  /** Gently rising net-worth series, normalized 0–1 (1 = top of the plot). */
  trend: [0.18, 0.3, 0.26, 0.55, 0.5, 0.74, 0.86, 0.96],
  ranges: ["1W", "1M", "3M", "1Y", "ALL"] as RangeKey[],
  activeRange: "1M" as RangeKey,
  allocation: {
    meta: "5 CLASSES",
    classes: [
      { name: "Equities", swatch: color.blue, fraction: 0.44, value: "$1.24M · 44%" },
      { name: "Retirement", swatch: color.green, fraction: 0.24, value: "$680K · 24%" },
      { name: "Cash & HYSA", swatch: color.fg2, fraction: 0.18, value: "$509K · 18%" },
      { name: "Crypto", swatch: color.yellow, fraction: 0.07, value: "$210K · 7%" },
      { name: "Private · SAFE", swatch: color.fg4, fraction: 0.07, value: "$190K · 7%" },
    ] satisfies AllocationClass[],
  },
  accounts: {
    meta: "6 LINKED · PLAID",
    rows: [
      { name: "Schwab Brokerage", sub: "EQUITIES", value: "$1,240,000", delta: "1.2%", tone: "up" },
      { name: "Fidelity 401(k)", sub: "RETIREMENT", value: "$680,000", delta: "0.9%", tone: "up" },
      { name: "Marcus HYSA", sub: "CASH · 4.4% APY", value: "$420,000", delta: "0.4%", tone: "up" },
      { name: "Chase Checking", sub: "CASH", value: "$89,000", delta: "flat", tone: "held" },
      { name: "Coinbase", sub: "CRYPTO", value: "$210,500", delta: "3.4%", tone: "muted" },
      { name: "AngelList SAFE", sub: "PRIVATE", value: "$190,000", delta: "held", tone: "held" },
    ] satisfies Account[],
  },
};
