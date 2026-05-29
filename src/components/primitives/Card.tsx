import type { ReactNode } from "react";

type CardProps = {
  num?: string; // "01"
  title?: string; // "OPERATOR"
  meta?: ReactNode; // right-aligned mono caption
  children?: ReactNode;
  className?: string;
};

/** The signature `NN //` instrument-panel card. Border, never shadow. */
export function Card({ num, title, meta, children, className = "" }: CardProps) {
  const showHeader = num || title || meta;
  return (
    <section
      className={`os-card-hover os-entrance bg-[color:var(--os-bg-2)] border border-[color:var(--os-line-1)] rounded-os-card p-4 ${className}`}
    >
      {showHeader && (
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 font-mono">
            {num && <span className="text-[10px] text-[color:var(--os-fg-5)]">{num}</span>}
            {num && <span className="text-[10px] text-[color:var(--os-fg-5)]">{"//"}</span>}
            {title && (
              <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-fg-3)]">
                {title}
              </span>
            )}
          </div>
          {meta && <div className="font-mono text-[10px] text-[color:var(--os-fg-4)]">{meta}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
