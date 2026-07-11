import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type FinanceAccountRow = Database["public"]["Tables"]["finance_accounts"]["Row"];
type FinanceSnapshotRow = Database["public"]["Tables"]["finance_snapshots"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/** Matches the `finance_accounts.type` check constraint (see
 * `supabase/migrations/20260527120005_create_finance.sql`). */
export type FinanceAccountType = "BANK" | "HYSA" | "EQUITY" | "RETIRE" | "CRYPTO" | "PRIVATE" | "T_BILLS";

export type MoneyGroup = "cash" | "invested" | "debt";

export type MoneyAccount = {
  id: string;
  name: string;
  type: FinanceAccountType;
  /** The account's latest value — `finance_accounts.current_value` IS the
   * latest value (every write updates it alongside a `finance_snapshots` row). */
  currentValue: number;
  group: MoneyGroup;
  source: string;
};

export type NetWorthPoint = { date: string; value: number };

export type MoneyTransaction = {
  id: string;
  name: string;
  amount: number;
  category: string;
  occurredAt: string;
};

export type MoneyGroupTotals = { cash: number; invested: number; debt: number };

export type UseMoneyResult = {
  accounts: MoneyAccount[];
  netWorth: number;
  groups: MoneyGroupTotals;
  /** Net worth over time — daily sum of `finance_snapshots.value` across all
   * accounts, for whichever dates have at least one snapshot. Note a date's
   * point only reflects accounts that snapshotted that day, so sparse sync
   * history can under-represent net worth on a given point. */
  netWorthSeries30d: NetWorthPoint[];
  netWorthSeries90d: NetWorthPoint[];
  /** |sum of negative transaction amounts this calendar month|. */
  monthBurn: number;
  /** This month's `budgets` row amount, or null when none is set. */
  budgetAmount: number | null;
  /** Liquid CASH total ÷ avg monthly burn over the last 3 calendar months
   * (current + prior 2, missing months count as 0 burn). Null when that
   * average is 0 (no burn / no data) — avoids a div-by-zero or a misleading
   * "infinite runway" reading. */
  runwayMonths: number | null;
  /** Last 8 transactions, newest first (independent of calendar month). */
  recent: MoneyTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Insert a new account + an opening `finance_snapshots` row for today. */
  addAccount: (name: string, type: FinanceAccountType, value: number) => Promise<void>;
  /** Update an account's current value + upsert today's snapshot (one row
   * per account per day — a same-day re-edit overwrites, per the table's
   * `unique(account_id, date)`). */
  updateAccountValue: (id: string, value: number) => Promise<void>;
  addTransaction: (input: { name: string; amount: number; category: string }) => Promise<void>;
  /** Upsert the current month's budget amount (`unique(user_id, month)`). */
  setBudget: (amount: number) => Promise<void>;
};

const NET_WORTH_LOOKBACK_DAYS = 90;
const BURN_LOOKBACK_MONTHS = 3;
const RECENT_LIMIT = 8;

/** Cash-classified account types (matches server logic in
 * `src/lib/assistant/context.ts`'s `CASH_TYPES` — keep these in sync). */
const CASH_TYPES = new Set<FinanceAccountType>(["BANK", "HYSA", "T_BILLS"]);

/** YYYY-MM-DD in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight `days` ago (0 = today). */
function daysAgo(days: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - days);
  return d;
}

/** First-of-month Date, `monthOffset` months from `d` (0 = d's own month). */
function monthStart(d: Date, monthOffset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
}

/** "YYYY-MM" bucket key for a month-start Date. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM-01" — the `budgets.month` / `date` column format (first of month). */
function monthStartYMD(d: Date): string {
  return `${monthKey(d)}-01`;
}

/** A negative `current_value` always reads as DEBT regardless of the
 * account's declared type (e.g. an overdrawn BANK account) — matches server
 * `classifyAccount` in `src/lib/assistant/context.ts`. */
function classifyAccount(type: string, currentValue: number): MoneyGroup {
  if (currentValue < 0) return "debt";
  return CASH_TYPES.has(type as FinanceAccountType) ? "cash" : "invested";
}

function mapAccount(row: FinanceAccountRow): MoneyAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as FinanceAccountType,
    currentValue: row.current_value,
    group: classifyAccount(row.type, row.current_value),
    source: row.source,
  };
}

/** Sums every snapshot's `value` per date (across accounts), ascending by date. */
function buildNetWorthSeries(rows: FinanceSnapshotRow[]): NetWorthPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.date, (totals.get(row.date) ?? 0) + row.value);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, value]) => ({ date, value }));
}

/** Slices an ascending net-worth series to points within the last `days` days. */
function lastNDaysOfSeries(series: NetWorthPoint[], days: number): NetWorthPoint[] {
  const cutoff = ymd(daysAgo(days - 1));
  return series.filter((p) => p.date >= cutoff);
}

/** |sum of negative amounts| bucketed by "YYYY-MM" — buckets absent from
 * `rows` implicitly total 0 when read via `.get(key) ?? 0`. */
function bucketMonthlyBurn(rows: Pick<TransactionRow, "amount" | "occurred_at">[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0) continue;
    const key = monthKey(new Date(row.occurred_at));
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(row.amount));
  }
  return totals;
}

/** Avg burn over the last `BURN_LOOKBACK_MONTHS` calendar months (current +
 * prior, missing months count as 0) → liquid cash ÷ that average, or null
 * when the average is 0 (no burn / no data — avoids div-by-zero). */
function computeRunwayMonths(cashTotal: number, monthlyBurn: Map<string, number>, now: Date): number | null {
  let sum = 0;
  for (let i = 0; i < BURN_LOOKBACK_MONTHS; i++) {
    sum += monthlyBurn.get(monthKey(monthStart(now, -i))) ?? 0;
  }
  const avgBurn = sum / BURN_LOOKBACK_MONTHS;
  if (avgBurn === 0) return null;
  return cashTotal / avgBurn;
}

/**
 * Money (read + write). Reads: accounts (grouped CASH/INVESTED/DEBT — a
 * negative balance always reads DEBT), a 90-day net-worth series (summed
 * `finance_snapshots` per date, 30d sliced from the same fetch), this
 * month's burn + budget, a 3-month burn average driving `runwayMonths`, and
 * the 8 most recent transactions. Writes go through `refetch()` afterward
 * rather than patching every derived aggregate optimistically — net worth,
 * group totals, burn and runway all depend on the full account/transaction
 * set, so a full refetch is the safer source of truth (contrast useTasks.ts's
 * single-field optimistic toggle).
 */
export function useMoney(): UseMoneyResult {
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [netWorthSeries90d, setNetWorthSeries90d] = useState<NetWorthPoint[]>([]);
  const [monthBurn, setMonthBurn] = useState(0);
  const [runwayMonths, setRunwayMonths] = useState<number | null>(null);
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null);
  const [recent, setRecent] = useState<MoneyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const now = new Date();
    const netWorthSinceYMD = ymd(daysAgo(NET_WORTH_LOOKBACK_DAYS - 1));
    const burnSinceISO = monthStart(now, -(BURN_LOOKBACK_MONTHS - 1)).toISOString();
    const currentMonthYMD = monthStartYMD(now);

    const [accountsRes, snapshotsRes, burnTxRes, budgetRes, recentRes] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("created_at", { ascending: true }),
      supabase.from("finance_snapshots").select("*").gte("date", netWorthSinceYMD),
      supabase.from("transactions").select("amount,occurred_at").gte("occurred_at", burnSinceISO),
      supabase.from("budgets").select("*").eq("month", currentMonthYMD).maybeSingle(),
      supabase.from("transactions").select("*").order("occurred_at", { ascending: false }).limit(RECENT_LIMIT),
    ]);

    const err =
      accountsRes.error ?? snapshotsRes.error ?? burnTxRes.error ?? budgetRes.error ?? recentRes.error ?? null;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mappedAccounts = (accountsRes.data ?? []).map(mapAccount);
    setAccounts(mappedAccounts);

    const series90 = buildNetWorthSeries(snapshotsRes.data ?? []);
    setNetWorthSeries90d(series90);

    const monthlyBurn = bucketMonthlyBurn(burnTxRes.data ?? []);
    setMonthBurn(monthlyBurn.get(monthKey(now)) ?? 0);

    const cashTotal = mappedAccounts.filter((a) => a.group === "cash").reduce((sum, a) => sum + a.currentValue, 0);
    setRunwayMonths(computeRunwayMonths(cashTotal, monthlyBurn, now));

    setBudgetAmount(budgetRes.data?.amount ?? null);

    setRecent(
      (recentRes.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        category: t.category,
        occurredAt: t.occurred_at,
      })),
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const addAccount = useCallback(
    async (name: string, type: FinanceAccountType, value: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { data, error: err } = await supabase
        .from("finance_accounts")
        .insert({ user_id: user.id, name, type, current_value: value })
        .select("id")
        .single();
      if (err || !data) {
        setError(err?.message ?? "Failed to add account");
        return;
      }
      const { error: snapErr } = await supabase
        .from("finance_snapshots")
        .insert({ user_id: user.id, account_id: data.id, date: ymd(new Date()), value });
      if (snapErr) {
        setError(snapErr.message);
        return;
      }
      await refetch();
    },
    [refetch],
  );

  const updateAccountValue = useCallback(
    async (id: string, value: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { error: updErr } = await supabase.from("finance_accounts").update({ current_value: value }).eq("id", id);
      if (updErr) {
        setError(updErr.message);
        return;
      }
      const { error: snapErr } = await supabase
        .from("finance_snapshots")
        .upsert(
          { user_id: user.id, account_id: id, date: ymd(new Date()), value },
          { onConflict: "account_id,date" },
        );
      if (snapErr) {
        setError(snapErr.message);
        return;
      }
      await refetch();
    },
    [refetch],
  );

  const addTransaction = useCallback(
    async (input: { name: string; amount: number; category: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { error: err } = await supabase.from("transactions").insert({
        user_id: user.id,
        name: input.name,
        amount: input.amount,
        category: input.category,
      });
      if (err) {
        setError(err.message);
        return;
      }
      await refetch();
    },
    [refetch],
  );

  const setBudget = useCallback(
    async (amount: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { error: err } = await supabase
        .from("budgets")
        .upsert({ user_id: user.id, month: monthStartYMD(new Date()), amount }, { onConflict: "user_id,month" });
      if (err) {
        setError(err.message);
        return;
      }
      await refetch();
    },
    [refetch],
  );

  const netWorth = accounts.reduce((sum, a) => sum + a.currentValue, 0);
  const groups: MoneyGroupTotals = { cash: 0, invested: 0, debt: 0 };
  for (const a of accounts) groups[a.group] += a.currentValue;

  return {
    accounts,
    netWorth,
    groups,
    netWorthSeries30d: lastNDaysOfSeries(netWorthSeries90d, 30),
    netWorthSeries90d,
    monthBurn,
    budgetAmount,
    runwayMonths,
    recent,
    loading,
    error,
    refetch,
    addAccount,
    updateAccountValue,
    addTransaction,
    setBudget,
  };
}
