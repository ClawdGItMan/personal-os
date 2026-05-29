import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { Ring } from "@/components/primitives/Ring";
import { Sparkline } from "@/components/primitives/Sparkline";
import { Sparkbars } from "@/components/primitives/Sparkbars";
import { EmptyState } from "@/components/primitives/EmptyState";

function BigValue({ value }: { value: string }) {
  return (
    <div className="font-mono os-tnum text-2xl text-[color:var(--os-fg-1)]">{value}</div>
  );
}

export default async function HealthPage() {
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("health_snapshots")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: history } = await supabase
    .from("health_snapshots")
    .select("date,weight,hrv,steps")
    .order("date", { ascending: true })
    .limit(60);

  const rows = history ?? [];
  const hrvSeries = rows.map((h) => h.hrv).filter((v): v is number => v != null).map(Number);
  const weightSeries = rows.map((h) => h.weight).filter((v): v is number => v != null).map(Number);
  const stepSeries = rows.map((h) => h.steps).filter((v): v is number => v != null).map(Number);
  const hrvFrom = Math.max(0, hrvSeries.length - 7);
  const stepFrom = Math.max(0, stepSeries.length - 7);

  return (
    <>
      <PageHeader
        title="Body ·"
        emphasis={
          latest?.recovery_score != null
            ? Number(latest.recovery_score) >= 66
              ? "recovered."
              : "recovering."
            : "—"
        }
        sub="HEALTH"
      />

      <Card num="01" title="THIS MORNING" meta="LATEST">
        {!latest ? (
          <EmptyState caption="No health data yet — log weight from the dashboard" />
        ) : (
          <div className="flex items-center gap-6 flex-wrap">
            {latest.recovery_score != null && (
              <Ring
                pct={Number(latest.recovery_score)}
                center={String(latest.recovery_score)}
                sub="RECOVERY"
              />
            )}
            {latest.sleep_score != null && (
              <Ring
                pct={Number(latest.sleep_score)}
                center={String(latest.sleep_score)}
                color="var(--os-honey)"
                sub="SLEEP"
              />
            )}
            {latest.strain != null && (
              <Ring
                pct={(Number(latest.strain) / 21) * 100}
                center={Number(latest.strain).toFixed(1)}
                color="var(--os-ember)"
                sub="STRAIN"
              />
            )}
            {latest.sleep_hours != null && (
              <div>
                <BigValue value={`${Number(latest.sleep_hours)}H`} />
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)] mt-1">
                  SLEEP
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {latest && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Card num="02" title="HRV" meta="ms">
            {latest.hrv != null ? (
              <>
                <BigValue value={String(latest.hrv)} />
                {hrvSeries.length > 0 && (
                  <div className="mt-2">
                    <Sparkbars data={hrvSeries} highlightFrom={hrvFrom} height={48} />
                  </div>
                )}
              </>
            ) : (
              <div className="font-mono text-[11px] text-[color:var(--os-fg-4)]">—</div>
            )}
          </Card>

          <Card num="03" title="WEIGHT" meta={latest.weight_unit || "lb"}>
            {latest.weight != null ? (
              <>
                <BigValue value={String(latest.weight)} />
                {weightSeries.length > 1 && (
                  <div className="mt-2">
                    <Sparkline data={weightSeries} height={48} />
                  </div>
                )}
              </>
            ) : (
              <div className="font-mono text-[11px] text-[color:var(--os-fg-4)]">—</div>
            )}
          </Card>

          <Card num="04" title="STEPS">
            {latest.steps != null ? (
              <>
                <BigValue value={Number(latest.steps).toLocaleString()} />
                {stepSeries.length > 0 && (
                  <div className="mt-2">
                    <Sparkbars data={stepSeries} highlightFrom={stepFrom} height={48} />
                  </div>
                )}
              </>
            ) : (
              <div className="font-mono text-[11px] text-[color:var(--os-fg-4)]">—</div>
            )}
          </Card>
        </div>
      )}

      {latest && (latest.rhr != null || latest.vo2_max != null) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {latest.rhr != null && (
            <Card num="05" title="RHR" meta="bpm">
              <BigValue value={String(latest.rhr)} />
            </Card>
          )}
          {latest.vo2_max != null && (
            <Card num="06" title="VO2 MAX">
              <BigValue value={String(latest.vo2_max)} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
