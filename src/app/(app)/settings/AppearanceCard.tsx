const PILL = "rounded-os-pill px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]";

export function AppearanceCard() {
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          aria-current="true"
          className={`${PILL} bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-2)] text-[color:var(--os-fg-1)]`}
        >
          Dark
        </button>
        <button
          type="button"
          disabled
          className={`${PILL} opacity-50 cursor-not-allowed border border-[color:var(--os-line-1)] text-[color:var(--os-fg-4)]`}
        >
          Cream
        </button>
        <button
          type="button"
          disabled
          className={`${PILL} opacity-50 cursor-not-allowed border border-[color:var(--os-line-1)] text-[color:var(--os-fg-4)]`}
        >
          Warm
        </button>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        Cream &amp; Warm themes arrive in Phase 3. Dark ships today.
      </p>
    </div>
  );
}
