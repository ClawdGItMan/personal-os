type KpiItem = { value: string; label: string; accent?: boolean };

/** Inline KPI cluster: value over a mono caption, gap-separated. */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="flex flex-wrap gap-6">
      {items.map((it, i) => (
        <div key={i}>
          <div
            className={`font-mono os-tnum text-lg ${
              it.accent ? "text-[color:var(--os-accent)]" : "text-[color:var(--os-fg-1)]"
            }`}
          >
            {it.value}
          </div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
