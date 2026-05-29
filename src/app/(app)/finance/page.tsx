import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { Sparkline } from "@/components/primitives/Sparkline";
import { StatRow } from "@/components/primitives/StatRow";
import { StatCell } from "@/components/primitives/StatCell";
import { EmptyState } from "@/components/primitives/EmptyState";
import { fmtUSD, fmtUSDDelta, fmtPct, isoDaysAgo } from "@/lib/format";

const CLASS_COLOR: Record<string, string> = {
  EQUITY: "var(--os-accent)",
  CRYPTO: "var(--os-ember)",
  RETIRE: "var(--os-honey)",
  HYSA: "var(--os-fg-3)",
  BANK: "var(--os-fg-4)",
  T_BILLS: "var(--os-fg-2)",
  PRIVATE: "var(--os-rust)",
};

function classColor(type: string): string {
  return CLASS_COLOR[type] ?? "var(--os-fg-4)";
}

export default async function FinancePage() {
  const supabase = await createClient();

  const { data: accountsData } = await supabase
    .from("finance_accounts")
    .select("id,name,type,current_value")
    .order("current_value", { ascending: false });
  const accounts = accountsData ?? [];

  const since = isoDaysAgo(30);
  const { data: snapsData } = await supabase
    .from("finance_snapshots")
    .select("date,value")
    .gte("date", since)
    .order("date", { ascending: true });
  const snaps = snapsData ?? [];

  const byDate = new Map<string, number>();
  for (const s of snaps) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + Number(s.value));
  }
  const series = [...byDate.values()];

  const total = accounts.reduce((sum, a) => sum + Number(a.current_value), 0);

  const hasSeries = series.length >= 2;
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  const periodDelta = last - first;
  const periodPct = first !== 0 ? (periodDelta / first) * 100 : 0;
  const up = periodDelta >= 0;

  const byClass = new Map<string, number>();
  for (const a of accounts) {
    byClass.set(a.type, (byClass.get(a.type) ?? 0) + Number(a.current_value));
  }
  const allocation = [...byClass.entries()]
    .map(([type, value]) => ({ type, value, share: total > 0 ? value / total : 0 }))
    .sort((x, y) => y.value - x.value);

  return (
    <>
      <PageHeader
        title="Net worth ·"
        emphasis={fmtUSD(total)}
        sub={`FINANCE · ${accounts.length} ${accounts.length === 1 ? "ACCOUNT" : "ACCOUNTS"}`}
      />

      <Card num="01" title="PORTFOLIO TRAJECTORY" meta="30D">
        {hasSeries ? (
          <>
            <Sparkline data={series} height={120} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <StatCell label="PERIOD" value={fmtUSDDelta(periodDelta)} accent={up} />
              <StatCell label="CHANGE" value={fmtPct(periodPct)} accent={up} />
              <StatCell label="CURRENT" value={fmtUSD(last)} />
            </div>
          </>
        ) : (
          <EmptyState caption="No snapshot history yet" />
        )}
      </Card>

      <Card num="02" title="ACCOUNTS" meta={`${accounts.length} CONNECTED`}>
        {accounts.length > 0 ? (
          accounts.map((a) => (
            <StatRow
              key={a.id}
              icon={a.type.slice(0, 2)}
              name={a.name}
              sub={a.type}
              value={fmtUSD(Number(a.current_value))}
            />
          ))
        ) : (
          <EmptyState caption="No accounts yet — add one from the dashboard" />
        )}
      </Card>

      {accounts.length > 0 && (
        <Card num="03" title="ALLOCATION" meta="BY CLASS">
          <div className="flex h-6 w-full rounded-os-inner overflow-hidden border border-[color:var(--os-line-1)]">
            {allocation.map((c) => (
              <div
                key={c.type}
                style={{ width: `${c.share * 100}%`, backgroundColor: classColor(c.type) }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {allocation.map((c) => (
              <li key={c.type} className="flex items-center gap-2.5">
                <span
                  className="inline-block h-2 w-2 rounded-os-inner shrink-0"
                  style={{ backgroundColor: classColor(c.type) }}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-3)]">
                  {c.type}
                </span>
                <span className="ml-auto font-mono os-tnum text-sm text-[color:var(--os-fg-1)]">
                  {fmtUSD(c.value)}
                </span>
                <span className="font-mono text-[10px] text-[color:var(--os-fg-4)] w-12 text-right">
                  {(c.share * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
