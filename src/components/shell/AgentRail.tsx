import { EmptyState } from "@/components/primitives/EmptyState";

/** Phase-1A agent placeholder. Keeps the panel chrome; no live behavior (Phase 2). */
export function AgentRail() {
  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] sticky top-[4.5rem] bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-1)] rounded-os-card overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-[color:var(--os-line-1)]">
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[10px] text-[color:var(--os-fg-5)]">11</span>
          <span className="text-[10px] text-[color:var(--os-fg-5)]">{"//"}</span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-fg-3)]">AGENT</span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-os-pill bg-[color:var(--os-bg-3)] text-[color:var(--os-fg-4)] border border-[color:var(--os-line-2)]">
          PHASE 2
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
        <EmptyState caption="Agent arrives in Phase 2" />
        <p className="font-mono text-[10px] text-center text-[color:var(--os-fg-5)] max-w-[200px]">
          ↗ TELEGRAM · not yet wired
        </p>
      </div>

      <div className="p-4 border-t border-[color:var(--os-line-1)]">
        <div className="flex gap-2 opacity-40 pointer-events-none" aria-hidden="true">
          <div className="flex-1 px-3 py-2 bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-inner font-mono text-[11px] text-[color:var(--os-fg-5)]">
            Message — Phase 2
          </div>
          <div className="px-4 py-2 bg-[color:var(--os-bg-3)] rounded-os-inner text-sm text-[color:var(--os-fg-5)]">
            ↑
          </div>
        </div>
      </div>
    </div>
  );
}
