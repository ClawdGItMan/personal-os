import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/primitives/Card";
import { FollowerForm } from "./social/FollowerForm";

export async function SocialCard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_followers")
    .select("platform, count, date")
    .order("date", { ascending: false });

  // Latest count per platform (rows are date-desc, so first seen wins).
  const latest = new Map<string, number>();
  for (const r of data ?? []) {
    if (!latest.has(r.platform)) latest.set(r.platform, r.count);
  }
  const total = [...latest.values()].reduce((s, n) => s + n, 0);

  return (
    <Card num="09" title="SOCIAL" meta={latest.size > 0 ? `${latest.size} PLATFORMS` : ""}>
      <div className="font-mono text-2xl os-tnum text-[color:var(--os-fg-1)]">
        {total.toLocaleString()}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        total followers
      </div>

      {latest.size > 0 && (
        <div className="flex flex-col gap-1 mt-3">
          {[...latest.entries()].map(([plat, n]) => (
            <div key={plat} className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--os-fg-3)]">
                {plat}
              </span>
              <span className="font-mono text-sm os-tnum text-[color:var(--os-fg-1)]">
                {n.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <FollowerForm />
    </Card>
  );
}
