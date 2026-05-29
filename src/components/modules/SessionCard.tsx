"use client";

import { Card } from "@/components/primitives/Card";
import { useClock } from "@/lib/hooks/useClock";
import { greeting, fmtClock, fmtDate } from "@/lib/format";

export function SessionCard({ first, timezone }: { first: string; timezone: string }) {
  const now = useClock();
  const c = now ? fmtClock(now) : null;

  return (
    <Card num="02" title="SESSION" meta={now ? fmtDate(now) : ""}>
      <div className="font-display text-2xl leading-tight text-[color:var(--os-fg-1)]">
        {now ? greeting(now) : "Welcome"},{" "}
        <span className="italic text-[color:var(--os-accent)]">{first}.</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2 os-tnum font-mono text-[color:var(--os-fg-1)]">
        {c ? (
          <>
            <span className="text-[44px] leading-none">{c.hh}</span>
            <span className="text-[44px] leading-none os-blink">:</span>
            <span className="text-[44px] leading-none">{c.mm}</span>
            <span className="text-[22px] leading-none text-[color:var(--os-fg-4)] self-end">{c.ss}</span>
          </>
        ) : (
          <span className="text-[44px] leading-none text-[color:var(--os-fg-4)]">--:--</span>
        )}
      </div>

      {timezone && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-5)]">
          {timezone}
        </div>
      )}

      {/* Capture bar — visual only this slice; wired to a server action in 1A.4 */}
      <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="Capture a thought, task, meal, lift…"
          aria-label="Capture"
          className="flex-1 px-3 py-2 bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-inner text-sm text-[color:var(--os-fg-1)] placeholder:text-[color:var(--os-fg-5)] focus:outline-none focus:border-[color:var(--os-accent)] focus:shadow-[0_0_0_3px_var(--os-accent-soft)] transition-all"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-os-inner text-sm font-medium"
        >
          Send
        </button>
      </form>
    </Card>
  );
}
