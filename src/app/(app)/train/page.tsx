import { createClient } from "@/lib/supabase/server";
import { getOperator } from "@/lib/operator";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { Sparkbars } from "@/components/primitives/Sparkbars";
import { KpiRow } from "@/components/primitives/KpiRow";
import { StatRow } from "@/components/primitives/StatRow";
import { EmptyState } from "@/components/primitives/EmptyState";
import { fmtDate } from "@/lib/format";
import { ActivityList, type ActivityWorkout } from "@/components/modules/train/ActivityList";

type Lift = {
  name: string;
  weight: number;
  weight_unit: string;
  reps: number;
  sets: number;
  is_pr: boolean;
};

type RecentLift = { weight: number; reps: number; sets: number };

export default async function TrainPage() {
  const supabase = await createClient();
  const operator = await getOperator();
  const timeZone = operator?.timezone?.trim() || "UTC";

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id,split_name,started_at,notes")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lifts: Lift[] = [];
  if (session) {
    const { data: liftData } = await supabase
      .from("lifts")
      .select("name,weight,weight_unit,reps,sets,is_pr")
      .eq("session_id", session.id);
    lifts = (liftData ?? []) as Lift[];
  }

  const { data: recentData } = await supabase
    .from("training_sessions")
    .select("id,started_at,lifts(weight,reps,sets)")
    .order("started_at", { ascending: false })
    .limit(8);

  const volumeSeries = (recentData ?? [])
    .slice()
    .reverse()
    .map((s) =>
      ((s.lifts ?? []) as RecentLift[]).reduce(
        (sum, l) => sum + Number(l.weight) * Number(l.reps) * Number(l.sets),
        0,
      ),
    );

  const hasVolume = volumeSeries.some((v) => v > 0);
  const latestVol = volumeSeries[volumeSeries.length - 1] ?? 0;
  const priorVol = volumeSeries[volumeSeries.length - 2] ?? 0;

  const kpiItems: { value: string; label: string; accent?: boolean }[] = [
    { value: `${latestVol.toLocaleString()} lb`, label: "Latest session", accent: true },
  ];
  if (volumeSeries.length >= 2) {
    const delta = latestVol - priorVol;
    const sign = delta >= 0 ? "+" : "−";
    kpiItems.push({
      value: `${sign}${Math.abs(delta).toLocaleString()} lb`,
      label: "vs prior session",
    });
  }

  const { data: prData } = await supabase
    .from("lifts")
    .select("name,weight,weight_unit,created_at")
    .eq("is_pr", true)
    .order("created_at", { ascending: false })
    .limit(6);
  const prs = prData ?? [];

  const { data: workouts } = await supabase
    .from("workouts")
    .select("sport, started_at, duration_sec, strain, avg_hr")
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <>
      <PageHeader
        title={session?.split_name ?? "Training"}
        emphasis={session ? undefined : "no session yet"}
        sub={session ? fmtDate(new Date(session.started_at)) : "TRAIN"}
      />

      <Card num="01" title="SESSION LIFTS" meta={session ? `${lifts.length} LIFTS` : undefined}>
        {!session ? (
          <EmptyState caption="No sessions yet — start one from the dashboard" />
        ) : (
          lifts.map((lift, i) => (
            <div
              key={i}
              className="grid grid-cols-[44px_1fr_auto_44px] gap-2 items-center py-2 border-t border-[color:var(--os-line-1)] first:border-t-0"
            >
              <span className="font-mono text-[color:var(--os-fg-4)]">SET {i + 1}</span>
              <span className="text-sm">{lift.name}</span>
              <span className="font-mono text-[color:var(--os-fg-1)]">
                {Number(lift.reps)} × {Number(lift.weight)} {lift.weight_unit}
              </span>
              <span className="text-[color:var(--os-honey)]">{lift.is_pr ? "★ PR" : ""}</span>
            </div>
          ))
        )}
      </Card>

      {session && hasVolume && (
        <Card num="02" title="VOLUME · LAST 8 SESSIONS">
          <Sparkbars
            data={volumeSeries}
            height={90}
            highlightFrom={Math.max(0, volumeSeries.length - 1)}
          />
          <div className="mt-3">
            <KpiRow items={kpiItems} />
          </div>
        </Card>
      )}

      <Card num="03" title="RECENT PRS">
        {prs.length > 0 ? (
          prs.map((pr, i) => (
            <StatRow
              key={i}
              icon="PR"
              name={pr.name}
              value={`${Number(pr.weight)} ${pr.weight_unit}`}
              sub={fmtDate(new Date(pr.created_at))}
            />
          ))
        ) : (
          <EmptyState caption="No PRs logged yet" />
        )}
      </Card>

      <Card num="04" title="ACTIVITY">
        {(workouts ?? []).length > 0 ? (
          <ActivityList workouts={(workouts ?? []) as ActivityWorkout[]} timeZone={timeZone} />
        ) : (
          <EmptyState caption="No workouts yet" />
        )}
      </Card>
    </>
  );
}
