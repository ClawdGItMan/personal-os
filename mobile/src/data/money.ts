/**
 * Money mock data — design README §Money (spec 7b). Plaid is Max-owned and
 * deferred, so every value here is a static mock; nothing in this file is
 * ever overwritten by a live hook (contrast Home/Body's `applyLive*`).
 */
import type { StatusSegment } from "../components/spec/TitleBlock";
import { eyebrowDate } from "../lib/format";

export type LedgerTone = "pos" | "neg";

export type MoneyLedgerItem = {
  time: string;
  title: string;
  amount: string;
  tone: LedgerTone;
  /** "YDA" rows read at a fainter ink than same-day clock times (ink34 vs ink50). */
  muted?: boolean;
};

export type AccountStat = {
  label: string;
  value: string;
  sub: string;
  /** Value reads red instead of ink (the DEBT cell). */
  valueNegative?: boolean;
  /** Sub reads accent instead of ink50 (the INVESTED 30D delta). */
  subAccent?: boolean;
};

export const moneyData = {
  eyebrow: { left: eyebrowDate(new Date()), right: "RUNWAY 34 MO" }, // right stays mock — Plaid deferred
  title: "Money",
  status: ["Net worth's ", { b: "steady" }, " and May spend is on pace."] satisfies StatusSegment[],
  netWorth: {
    label: "NET WORTH",
    period: "30D",
    value: "$2.83M",
    sub: "+$847 TODAY · +0.03% 30D",
  }, // mock — Plaid deferred
  accounts: [
    { label: "CASH", value: "$412K", sub: "LIQUID" },
    { label: "INVESTED", value: "$2.31M", sub: "+1.2% · 30D", subAccent: true },
    { label: "DEBT", value: "-$104K", sub: "MORTGAGE", valueNegative: true },
  ] satisfies AccountStat[], // mock — Plaid deferred
  burn: {
    label: "MAY BURN",
    status: "ON PACE",
    spent: "$8.4K",
    ofBudget: "OF $12K",
    left: "$3.6K LEFT",
    /** 8.4K of 12K budget. */
    pct: 70,
  }, // mock — Plaid deferred
  ledger: {
    label: "RECENT",
    period: "TODAY · YDA",
    items: [
      { time: "11:42 AM", title: "Acme Ltd · wire in", amount: "+$12,500", tone: "pos" },
      { time: "9:15 AM", title: "Blue Bottle", amount: "-$7.40", tone: "neg" },
      { time: "YDA", title: "Equinox", amount: "-$210", tone: "neg", muted: true },
      { time: "YDA", title: "AWS", amount: "-$1,842", tone: "neg", muted: true },
    ] satisfies MoneyLedgerItem[],
  }, // mock — Plaid deferred
};
