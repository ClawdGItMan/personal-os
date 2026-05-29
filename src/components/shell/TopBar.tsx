"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClock } from "@/lib/hooks/useClock";
import { fmtClock, fmtDate } from "@/lib/format";
import { WEB_TABS } from "@/lib/nav";
import type { Operator } from "@/lib/types";

export function TopBar({ operator }: { operator: Operator }) {
  const pathname = usePathname();
  const now = useClock();
  const c = now ? fmtClock(now) : null;
  const dateStr = now ? fmtDate(now) : "";

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-[color:var(--os-line-1)]"
      style={{
        backgroundColor: "color-mix(in srgb, var(--os-bg) 82%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="os-dot os-pulse" />
        <span className="font-mono text-sm tracking-[0.08em] text-[color:var(--os-fg-1)]">MAX OS</span>
        <span className="font-mono text-[10px] text-[color:var(--os-fg-5)]">{"// V0"}</span>
      </div>

      <nav className="flex items-center gap-1">
        {WEB_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1.5 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] border transition-colors ${
                active
                  ? "bg-[color:var(--os-bg-2)] border-[color:var(--os-line-2)] text-[color:var(--os-fg-1)]"
                  : "border-transparent text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-2)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 font-mono">
        <span className="text-[10px] tracking-[0.1em] text-[color:var(--os-fg-4)]">{dateStr}</span>
        <span className="os-tnum text-sm text-[color:var(--os-fg-1)]">
          {c ? (
            <>
              {c.hh}
              <span className="os-blink">:</span>
              {c.mm}
            </>
          ) : (
            "--:--"
          )}
        </span>
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-7 h-7 rounded-os-pill bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] flex items-center justify-center text-[10px] text-[color:var(--os-fg-2)] hover:border-[color:var(--os-line-3)] transition-colors"
        >
          {operator.initials}
        </Link>
      </div>
    </header>
  );
}
