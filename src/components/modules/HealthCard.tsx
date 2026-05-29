import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { WeightForm } from "./health/WeightForm";

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-os-inner bg-[color:var(--os-bg-3)] px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)]">{label}</div>
      <div className="font-mono text-sm os-tnum text-[color:var(--os-fg-1)] mt-0.5">{value}</div>
    </div>
  );
}

export async function HealthCard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("health_snapshots")
    .select("weight, weight_unit, sleep_score, recovery_score, hrv")
    .order("date", { ascending: false })
    .limit(1);

  const snap = data?.[0];

  return (
    <Card num="08" title="HEALTH" meta={snap?.weight != null ? "LATEST" : ""}>
      <div className="grid grid-cols-2 gap-2">
        <KPI label="WEIGHT" value={snap?.weight != null ? `${snap.weight} ${snap.weight_unit}` : "—"} />
        <KPI label="SLEEP" value={snap?.sleep_score != null ? `${snap.sleep_score}` : "—"} />
        <KPI label="RECOVERY" value={snap?.recovery_score != null ? `${snap.recovery_score}%` : "—"} />
        <KPI label="HRV" value={snap?.hrv != null ? `${snap.hrv}` : "—"} />
      </div>
      <WeightForm />
    </Card>
  );
}
