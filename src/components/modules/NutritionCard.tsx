import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { Ring } from "@/components/primitives/Ring";
import { todayISO } from "@/lib/format";
import { MealForm } from "./nutrition/MealForm";

const KCAL_GOAL = 2200;

function Macro({ label, val }: { label: string; val: number }) {
  return (
    <div className="rounded-os-inner bg-[color:var(--os-bg-3)] py-1.5">
      <div className="font-mono text-sm os-tnum text-[color:var(--os-fg-1)]">{Math.round(val)}g</div>
      <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)]">{label}</div>
    </div>
  );
}

export async function NutritionCard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nutrition_entries")
    .select("kcal, protein_g, carbs_g, fat_g")
    .gte("eaten_at", `${todayISO()}T00:00:00`);

  const entries = data ?? [];
  const kcal = entries.reduce((s, e) => s + (e.kcal ?? 0), 0);
  const protein = entries.reduce((s, e) => s + Number(e.protein_g ?? 0), 0);
  const carbs = entries.reduce((s, e) => s + Number(e.carbs_g ?? 0), 0);
  const fat = entries.reduce((s, e) => s + Number(e.fat_g ?? 0), 0);
  const pct = (kcal / KCAL_GOAL) * 100;

  return (
    <Card num="07" title="NUTRITION" meta={`${entries.length} MEALS`}>
      <div className="flex items-center gap-4">
        <Ring pct={pct} center={`${kcal}`} sub="KCAL" />
        <div className="flex-1 grid grid-cols-3 gap-2 text-center">
          <Macro label="PROTEIN" val={protein} />
          <Macro label="CARBS" val={carbs} />
          <Macro label="FAT" val={fat} />
        </div>
      </div>
      <MealForm />
    </Card>
  );
}
