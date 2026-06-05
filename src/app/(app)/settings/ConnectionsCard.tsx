import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoogleIntegration } from "@/lib/integrations/store";
import { staleAgeLabel } from "@/lib/sync/stale";
import { StatRow } from "@/components/primitives/StatRow";
import { GoogleConnectionRow } from "./GoogleConnectionRow";

/** Providers still awaiting their Phase 1B slice — shown as static placeholders. */
const PENDING_PROVIDERS = [
  { icon: "PL", name: "Plaid", sub: "FINANCE" },
  { icon: "WH", name: "Whoop", sub: "HEALTH" },
  { icon: "HA", name: "Health Auto Export", sub: "APPLE HEALTH" },
] as const;

export async function ConnectionsCard() {
  const userId = await getCurrentUserId();
  const supabase = await createClient();
  const integration = userId ? await getGoogleIntegration(supabase, userId) : null;
  const syncedLabel = integration?.last_synced_at
    ? staleAgeLabel(integration.last_synced_at)
    : null;

  return (
    <div className="mt-3">
      <GoogleConnectionRow
        status={integration?.status ?? null}
        syncedLabel={syncedLabel}
        lastError={integration?.last_error ?? null}
      />
      {PENDING_PROVIDERS.map((p) => (
        <StatRow key={p.name} icon={p.icon} name={p.name} sub={p.sub} value="NOT CONNECTED" />
      ))}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
        More integrations arrive through Phase 1B.
      </p>
    </div>
  );
}
