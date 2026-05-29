"use client";

import Link from "next/link";
import { useClock } from "@/lib/hooks/useClock";
import { fmtClock } from "@/lib/format";

export function MobileTopBar({ initials }: { initials: string }) {
  const now = useClock();
  const c = now ? fmtClock(now) : null;

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[color:var(--os-line-1)]">
      <div className="flex items-center gap-2">
        <span className="os-dot os-pulse" />
        <span className="font-mono text-sm tracking-[0.08em] text-[color:var(--os-fg-1)]">MAX OS</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="os-tnum font-mono text-sm text-[color:var(--os-fg-2)]">
          {c ? `${c.hh}:${c.mm}` : "--:--"}
        </span>
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-7 h-7 rounded-os-pill bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-1)] flex items-center justify-center font-mono text-[10px] text-[color:var(--os-fg-2)] hover:border-[color:var(--os-line-2)] focus-visible:outline-none focus-visible:border-[color:var(--os-accent)] transition-colors"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
