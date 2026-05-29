"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/primitives/Card";
import { useClock } from "@/lib/hooks/useClock";
import { greeting, fmtClock, fmtDate } from "@/lib/format";
import { capture } from "@/app/(app)/_actions/capture";

export function SessionCard({ first, timezone }: { first: string; timezone: string }) {
  const now = useClock();
  const c = now ? fmtClock(now) : null;

  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onCapture(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setError("");
    startTransition(async () => {
      const res = await capture({ text: value });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

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

      {/* Capture bar — writes to journal_entries (Phase 2 agent will route intent) */}
      <form className="mt-4 flex gap-2" onSubmit={onCapture}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Capture a thought, task, meal, lift…"
          aria-label="Capture"
          disabled={pending}
          className="flex-1 px-3 py-2 bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-inner text-sm text-[color:var(--os-fg-1)] placeholder:text-[color:var(--os-fg-5)] focus:outline-none focus:border-[color:var(--os-accent)] focus:shadow-[0_0_0_3px_var(--os-accent-soft)] transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-os-inner text-sm font-medium disabled:opacity-60"
        >
          Send
        </button>
      </form>
      {saved && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-accent)]">
          ✓ captured to journal
        </div>
      )}
      {error && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-rust)]">
          {error}
        </div>
      )}
    </Card>
  );
}
