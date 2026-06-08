import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoogleIntegration, getIntegration } from "@/lib/integrations/store";
import { staleAgeLabel } from "@/lib/sync/stale";
import { StatRow } from "@/components/primitives/StatRow";
import { GoogleConnectionRow } from "./GoogleConnectionRow";
import { ProviderConnectionRow } from "./ProviderConnectionRow";

/** Providers still awaiting their Phase 1B slice — shown as static placeholders. */
const PENDING_PROVIDERS = [
  { icon: "PL", name: "Plaid", sub: "FINANCE" },
  { icon: "HA", name: "Health Auto Export", sub: "APPLE HEALTH" },
] as const;


export async function ConnectionsCard() {
  const userId = await getCurrentUserId();
  const supabase = await createClient();
  const integration = userId ? await getGoogleIntegration(supabase, userId) : null;
  const syncedLabel = integration?.last_synced_at
    ? staleAgeLabel(integration.last_synced_at)
    : null;

  const whoop = userId ? await getIntegration(supabase, userId, "whoop") : null;
  const whoopSyncedLabel = whoop?.last_synced_at
    ? staleAgeLabel(whoop.last_synced_at)
    : null;

  const strava = userId ? await getIntegration(supabase, userId, "strava") : null;
  const stravaSyncedLabel = strava?.last_synced_at
    ? staleAgeLabel(strava.last_synced_at)
    : null;

  return (
    <div className="mt-3">
      <GoogleConnectionRow
        status={integration?.status ?? null}
        syncedLabel={syncedLabel}
        lastError={integration?.last_error ?? null}
      />
      <ProviderConnectionRow
        provider="whoop"
        label="Whoop"
        sub="HEALTH"
        connectPath="/api/whoop/connect"
        status={whoop?.status ?? null}
        syncedLabel={whoopSyncedLabel}
        lastError={whoop?.last_error ?? null}
      />
      <ProviderConnectionRow
        provider="strava"
        label="Strava"
        sub="FITNESS"
        connectPath="/api/strava/connect"
        status={strava?.status ?? null}
        syncedLabel={stravaSyncedLabel}
        lastError={strava?.last_error ?? null}
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
