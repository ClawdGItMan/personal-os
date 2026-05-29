"use client";

import { useClock } from "@/lib/hooks/useClock";
import { fmtClock } from "@/lib/format";

export function MobileTopBar() {
  const now = useClock();
  const c = now ? fmtClock(now) : null;

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[color:var(--os-line-1)]">
      <div className="flex items-center gap-2">
        <span className="os-dot os-pulse" />
        <span className="font-mono text-sm tracking-[0.08em] text-[color:var(--os-fg-1)]">MAX OS</span>
      </div>
      <span className="os-tnum font-mono text-sm text-[color:var(--os-fg-2)]">
        {c ? `${c.hh}:${c.mm}` : "--:--"}
      </span>
    </header>
  );
}
