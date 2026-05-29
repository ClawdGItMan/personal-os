type PageHeaderProps = { title: string; emphasis?: string; sub: string };

/** Secondary-page title block: serif headline with an italic accent token + mono eyebrow. */
export function PageHeader({ title, emphasis, sub }: PageHeaderProps) {
  return (
    <header className="px-1 pt-1">
      <h1 className="font-display text-[2rem] leading-tight tracking-[-0.02em] text-[color:var(--os-fg-1)]">
        {title}
        {emphasis && (
          <>
            {" "}
            <em className="italic text-[color:var(--os-accent)]">{emphasis}</em>
          </>
        )}
      </h1>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--os-fg-4)]">
        {sub}
      </p>
    </header>
  );
}
