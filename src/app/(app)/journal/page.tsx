import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";
import { fmtDate } from "@/lib/format";

function deriveTitle(text: string, fallback: string): string {
  const firstLine = (text.split("\n")[0] ?? "").trim();
  if (!firstLine) return fallback;
  const sliced = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
  return sliced.toUpperCase();
}

export default async function JournalPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("journal_entries")
    .select("id,text,tags,written_at")
    .order("written_at", { ascending: false })
    .limit(50);

  const entries = data ?? [];

  return (
    <>
      <PageHeader
        title="Journal ·"
        emphasis={`${entries.length} ${entries.length === 1 ? "entry." : "entries."}`}
        sub="BRAIN · RECENT"
      />

      {entries.length === 0 ? (
        <EmptyState caption="No entries yet — capture one from the dashboard" />
      ) : (
        <div className="grid gap-3">
          {entries.map((entry, i) => {
            const written = new Date(entry.written_at);
            const date = fmtDate(written);
            const time = written.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return (
              <Card
                key={entry.id}
                num={String(i + 1).padStart(2, "0")}
                title={deriveTitle(entry.text, date)}
                meta={
                  <span className="font-mono os-tnum">{`${date} ${time}`}</span>
                }
              >
                <p className="font-display text-[17px] leading-relaxed text-[color:var(--os-fg-2)] whitespace-pre-wrap">
                  {entry.text}
                </p>
                {entry.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)] border border-[color:var(--os-line-2)] rounded-os-pill px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
