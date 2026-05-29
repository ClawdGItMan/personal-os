import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { todayISO } from "@/lib/format";
import { StartSessionForm } from "./train/StartSessionForm";
import { LiftForm } from "./train/LiftForm";

export async function TrainCard() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, split_name")
    .gte("started_at", `${todayISO()}T00:00:00`)
    .order("started_at", { ascending: false })
    .limit(1);

  const session = sessions?.[0];

  let lifts: Array<{
    id: string;
    name: string;
    weight: number;
    weight_unit: string;
    reps: number;
    sets: number;
    is_pr: boolean;
  }> = [];

  if (session) {
    const { data } = await supabase
      .from("lifts")
      .select("id, name, weight, weight_unit, reps, sets, is_pr")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    lifts = data ?? [];
  }

  return (
    <Card num="10" title="TRAINING" meta={session ? session.split_name.toUpperCase() : ""}>
      {!session ? (
        <StartSessionForm />
      ) : (
        <>
          {lifts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {lifts.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--os-fg-2)]">{l.name}</span>
                  <span className="font-mono os-tnum text-[color:var(--os-fg-1)] flex items-center gap-1.5">
                    {l.sets}×{l.reps} · {l.weight}
                    {l.weight_unit}
                    {l.is_pr && (
                      <span className="text-[color:var(--os-honey)] text-[9px] font-mono uppercase tracking-[0.1em]">
                        PR
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
              No lifts yet
            </div>
          )}
          <LiftForm sessionId={session.id} />
        </>
      )}
    </Card>
  );
}
