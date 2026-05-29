export function EmptyState({ caption }: { caption: string }) {
  return (
    <div className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
      {caption}
    </div>
  );
}
