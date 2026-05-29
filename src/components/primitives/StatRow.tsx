type StatRowProps = {
  icon: string;
  name: string;
  sub?: string;
  value: string;
  delta?: string;
  deltaDown?: boolean;
};

/** Icon · name/sub · value · delta row — finance accounts, social platforms, connections. */
export function StatRow({ icon, name, sub, value, delta, deltaDown }: StatRowProps) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-2.5 border-t border-[color:var(--os-line-1)] first:border-t-0">
      <span className="w-7 h-7 rounded-os-inner bg-[color:var(--os-bg-3)] flex items-center justify-center font-mono text-[10px] uppercase text-[color:var(--os-fg-3)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm text-[color:var(--os-fg-1)]">{name}</div>
        {sub && (
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
            {sub}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono os-tnum text-sm text-[color:var(--os-fg-1)]">{value}</div>
        {delta && (
          <div
            className={`font-mono text-[10px] ${
              deltaDown ? "text-[color:var(--os-rust)]" : "text-[color:var(--os-accent)]"
            }`}
          >
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}
