import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { Sparkbars } from "@/components/primitives/Sparkbars";
import { KpiRow } from "@/components/primitives/KpiRow";
import { StatRow } from "@/components/primitives/StatRow";
import { EmptyState } from "@/components/primitives/EmptyState";

export default async function SocialPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_followers")
    .select("platform,count,date")
    .order("date", { ascending: false });

  const rows = data ?? [];

  // Latest count per platform: rows are date-desc, so first seen wins.
  const seen = new Set<string>();
  const platforms: { platform: string; count: number }[] = [];
  for (const r of rows) {
    const platform = String(r.platform);
    if (seen.has(platform)) continue;
    seen.add(platform);
    platforms.push({ platform, count: Number(r.count) });
  }

  const total = platforms.reduce((sum, p) => sum + p.count, 0);

  // Growth series: sum counts per date, last ~30 distinct dates ascending.
  const byDate = new Map<string, number>();
  for (const r of rows) {
    const date = String(r.date);
    byDate.set(date, (byDate.get(date) ?? 0) + Number(r.count));
  }
  const totalSeries = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(-30)
    .map(([, sum]) => sum);

  const hasSeries = totalSeries.length >= 2;
  const netNew = hasSeries ? totalSeries[totalSeries.length - 1] - totalSeries[0] : 0;
  const netNewLabel = `${netNew >= 0 ? "+" : "-"}${Math.abs(netNew).toLocaleString()}`;

  return (
    <>
      <PageHeader
        title="Audience ·"
        emphasis={total.toLocaleString()}
        sub={`SOCIAL · ${platforms.length} ${platforms.length === 1 ? "PLATFORM" : "PLATFORMS"}`}
      />

      <Card num="01" title="GROWTH · 30D">
        {hasSeries ? (
          <>
            <Sparkbars
              data={totalSeries}
              height={100}
              highlightFrom={Math.max(0, totalSeries.length - 7)}
            />
            <KpiRow items={[{ value: netNewLabel, label: "Net new · 30D", accent: true }]} />
          </>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
            Not enough history yet
          </p>
        )}
      </Card>

      <Card num="02" title="PLATFORMS" meta={String(platforms.length)}>
        {platforms.length > 0 ? (
          platforms.map((p) => (
            <StatRow
              key={p.platform}
              icon={p.platform.slice(0, 2)}
              name={p.platform}
              sub="FOLLOWERS"
              value={p.count.toLocaleString()}
            />
          ))
        ) : (
          <EmptyState caption="No followers logged yet — add a count from the dashboard" />
        )}
      </Card>
    </>
  );
}
