/** Conic-gradient progress ring. Inner disc matches the card surface (--os-bg-2). */
export function Ring({
  pct,
  size = 56,
  center,
  sub,
  color = "var(--os-accent)",
}: {
  pct: number;
  size?: number;
  center: string;
  sub?: string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const innerInset = Math.round(size * 0.14);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${color} ${clamped}%, var(--os-bg-3) 0)` }}
      />
      <div
        className="absolute rounded-full bg-[color:var(--os-bg-2)] flex flex-col items-center justify-center"
        style={{ inset: innerInset }}
      >
        <span className="font-mono text-[11px] os-tnum text-[color:var(--os-fg-1)] leading-none">{center}</span>
        {sub && (
          <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[color:var(--os-fg-4)] mt-0.5">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
