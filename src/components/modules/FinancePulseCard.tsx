import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { Sparkline } from "@/components/primitives/Sparkline";
import { fmtUSD } from "@/lib/format";
import { FinanceClient, type Account } from "./finance/FinanceClient";

export async function FinancePulseCard() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, type, current_value")
    .order("current_value", { ascending: false });

  const accts = accounts ?? [];
  const netWorth = accts.reduce((s, a) => s + Number(a.current_value), 0);

  // Net-worth series = sum of all account snapshots per date.
  const { data: snaps } = await supabase
    .from("finance_snapshots")
    .select("date, value")
    .order("date", { ascending: true });

  const byDate = new Map<string, number>();
  for (const s of snaps ?? []) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + Number(s.value));
  }
  const series = [...byDate.values()];

  const rows: Account[] = accts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    value: Number(a.current_value),
  }));

  return (
    <Card num="03" title="FINANCE PULSE" meta="NET WORTH">
      <div className="font-mono text-2xl os-tnum text-[color:var(--os-fg-1)]">{fmtUSD(netWorth)}</div>
      {series.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={series} height={48} />
        </div>
      )}
      <FinanceClient initialAccounts={rows} />
    </Card>
  );
}
