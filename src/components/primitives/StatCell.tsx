type StatCellProps = { label: string; value: string; sub?: string; accent?: boolean };

/** Raised label/value/sub cell — finance trajectory stats, biomarkers. */
export function StatCell({ label, value, sub, accent }: StatCellProps) {
  return (
    <div className="bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-1)] rounded-os-inner p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono os-tnum text-lg ${
          accent ? "text-[color:var(--os-accent)]" : "text-[color:var(--os-fg-1)]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-[color:var(--os-fg-4)]">{sub}</div>}
    </div>
  );
}
