import { Card } from "@/components/primitives/Card";
import type { Operator } from "@/lib/types";

export function OperatorCard({ operator }: { operator: Operator }) {
  const sub = [operator.role, operator.location].filter(Boolean).join(" · ") || "—";
  return (
    <Card
      num="01"
      title="OPERATOR"
      meta={
        <span className="flex items-center gap-1.5">
          <span className="os-dot os-pulse" /> ONLINE
        </span>
      }
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-os-inner bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] flex items-center justify-center font-mono text-sm text-[color:var(--os-fg-2)]">
          {operator.initials}
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight text-[color:var(--os-fg-1)] truncate">
            {operator.name}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)] truncate">
            {sub}
          </div>
        </div>
      </div>

      {operator.focus && (
        <div className="mt-3 pt-3 border-t border-[color:var(--os-line-1)]">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-5)]">
            FOCUS
          </div>
          <div className="text-sm text-[color:var(--os-fg-2)] mt-0.5">{operator.focus}</div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        <span>STREAK</span>
        <span className="text-[color:var(--os-accent)]">{operator.streak} DAYS</span>
      </div>
    </Card>
  );
}
