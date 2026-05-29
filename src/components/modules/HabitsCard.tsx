import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { todayISO } from "@/lib/format";
import { HabitsClient, type HabitRow } from "./habits/HabitsClient";

export async function HabitsCard() {
  const supabase = await createClient();
  const today = todayISO();

  const { data: habits } = await supabase
    .from("habits")
    .select("id, name, sub_label")
    .eq("archived", false)
    .order("position", { ascending: true });

  const list = habits ?? [];

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("habit_id, done")
    .eq("date", today);

  const doneSet = new Set((logs ?? []).filter((l) => l.done).map((l) => l.habit_id));
  const rows: HabitRow[] = list.map((h) => ({
    id: h.id,
    name: h.name,
    sub: h.sub_label,
    done: doneSet.has(h.id),
  }));
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <Card num="05" title="HABITS" meta={`${doneCount} / ${rows.length}`}>
      <HabitsClient initialHabits={rows} />
    </Card>
  );
}
