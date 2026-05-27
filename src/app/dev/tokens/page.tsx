const COLOR_TOKENS = [
  "--os-bg", "--os-bg-2", "--os-bg-3", "--os-bg-hover", "--os-bg-sunk",
  "--os-fg-1", "--os-fg-2", "--os-fg-3", "--os-fg-4", "--os-fg-5",
  "--os-line-1", "--os-line-2", "--os-line-3",
  "--os-accent", "--os-accent-soft", "--os-accent-glow", "--os-accent-dim",
  "--os-ember", "--os-honey", "--os-rust",
];

const TYPE_SCALE = [
  { name: "text-5xl", size: "84px" },
  { name: "text-3xl", size: "44px" },
  { name: "text-2xl", size: "32px" },
  { name: "text-xl", size: "24px" },
  { name: "text-lg", size: "20px" },
  { name: "text-base", size: "15px" },
  { name: "text-sm", size: "13px" },
  { name: "text-xs", size: "12px" },
];

export default function TokensPage() {
  return (
    <main className="min-h-screen p-8 space-y-10">
      <div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--os-fg-3)]">
          DEV · DESIGN TOKENS
        </div>
        <h1 className="text-2xl mt-2 font-display">
          Token swatches
        </h1>
        <p className="text-sm text-[color:var(--os-fg-3)] mt-1">
          Switch themes by setting <code className="font-mono">data-theme</code> on
          {" "}<code className="font-mono">&lt;html&gt;</code> to cream or warm.
        </p>
      </div>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Color
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLOR_TOKENS.map((token) => (
            <div key={token} className="rounded-[10px] border border-[color:var(--os-line-2)] overflow-hidden">
              <div className="h-16" style={{ background: `var(${token})` }} />
              <div className="p-2 text-[11px] font-mono text-[color:var(--os-fg-3)]">{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Type scale
        </h2>
        <div className="space-y-2">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} style={{ fontSize: t.size }} className="font-display leading-tight">
              {t.name} — The hub for my life
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs tracking-[0.16em] uppercase text-[color:var(--os-fg-4)] mb-3">
          Font families
        </h2>
        <div className="space-y-2 text-lg">
          <p className="font-display">Newsreader — editorial serif display</p>
          <p className="font-body">Manrope — humanist sans body</p>
          <p className="font-mono">JetBrains Mono — 1234567890</p>
        </div>
      </section>
    </main>
  );
}
