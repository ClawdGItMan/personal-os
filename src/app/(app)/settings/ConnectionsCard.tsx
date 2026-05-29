import { StatRow } from "@/components/primitives/StatRow";

const PROVIDERS = [
  { icon: "PL", name: "Plaid", sub: "FINANCE" },
  { icon: "GO", name: "Google", sub: "CALENDAR · GMAIL" },
  { icon: "WH", name: "Whoop", sub: "HEALTH" },
  { icon: "HA", name: "Health Auto Export", sub: "APPLE HEALTH" },
] as const;

export function ConnectionsCard() {
  return (
    <div className="mt-3">
      {PROVIDERS.map((p) => (
        <StatRow
          key={p.name}
          icon={p.icon}
          name={p.name}
          sub={p.sub}
          value="NOT CONNECTED"
        />
      ))}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        Integrations arrive in Phase 1B.
      </p>
    </div>
  );
}
