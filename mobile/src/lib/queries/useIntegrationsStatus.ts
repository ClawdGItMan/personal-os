import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase";
import type { Database } from "../database.types";

type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["sync_runs"]["Row"];

export type IntegrationProvider = "whoop" | "google_calendar";
export type IntegrationDot = "green" | "amber" | "red";

export type IntegrationStatusItem = {
  provider: IntegrationProvider;
  label: string;
  connected: boolean;
  dot: IntegrationDot;
  /** Ready-to-render sub line — "LAST SYNC 2H AGO" / "NEVER SYNCED" /
   * "CONNECT ON WEB" / the last error, uppercased. */
  sub: string;
};

export type UseIntegrationsStatusResult = {
  items: IntegrationStatusItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const PROVIDERS: { key: IntegrationProvider; label: string }[] = [
  { key: "whoop", label: "WHOOP" },
  { key: "google_calendar", label: "GOOGLE CALENDAR" },
];

/** Matches the server sync jobs' "stale" threshold intent — a `connected`
 * integration whose last sync is older than this reads amber, not green
 * (see task brief: "amber(partial or stale >24h)"). */
const STALE_MS = 24 * 60 * 60 * 1000;

/** "5M AGO" / "2H AGO" / "3D AGO" — hand-rolled like lib/format.ts's
 * time12/eyebrowDate (kept local here rather than added to lib/format.ts,
 * which a sibling Wave-B task is editing concurrently — same reasoning as
 * components/money/format.ts). */
function relativeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, Date.now() - then);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}

/** Reduces one provider's `integrations` row + latest `sync_runs` row to a
 * status dot + sub line (task brief: "green(connected+recent sync)/
 * amber(partial or stale >24h)/red(error/expired)"). A missing `integrations`
 * row (never connected — connect flows live on the web app) is treated as
 * its own red "CONNECT ON WEB" case, since the 3-state spec is written for an
 * already-connected integration. */
function buildItem(
  key: IntegrationProvider,
  label: string,
  row: IntegrationRow | undefined,
  latestRun: SyncRunRow | undefined,
): IntegrationStatusItem {
  if (!row) {
    return { provider: key, label, connected: false, dot: "red", sub: "CONNECT ON WEB" };
  }
  if (row.status === "error" || row.status === "expired") {
    return {
      provider: key,
      label,
      connected: true,
      dot: "red",
      sub: (row.last_error || row.status).toUpperCase(),
    };
  }
  if (latestRun?.status === "partial") {
    return {
      provider: key,
      label,
      connected: true,
      dot: "amber",
      sub: row.last_synced_at ? `LAST SYNC ${relativeLabel(row.last_synced_at)} · PARTIAL` : "PARTIAL SYNC",
    };
  }
  if (!row.last_synced_at) {
    return { provider: key, label, connected: true, dot: "amber", sub: "NEVER SYNCED" };
  }
  const stale = Date.now() - new Date(row.last_synced_at).getTime() > STALE_MS;
  return {
    provider: key,
    label,
    connected: true,
    dot: stale ? "amber" : "green",
    sub: `LAST SYNC ${relativeLabel(row.last_synced_at)}`,
  };
}

/**
 * Per-provider integration health for Settings (task C3). Reads `integrations`
 * + each provider's latest `sync_runs` row through the standard `supabase`
 * client, which is bound to the signed-in user's session — RLS
 * (`auth.uid() = user_id` on both tables, see
 * `20260527120001_create_integrations_and_agent_messages.sql` /
 * `20260527120012_create_observability.sql`) scopes both reads without any
 * extra filtering here. Read-only: connect/reconnect/disconnect flows live on
 * the web app (Settings shows a "MANAGE ON WEB" caption, not a tappable row).
 */
export function useIntegrationsStatus(): UseIntegrationsStatusResult {
  const [items, setItems] = useState<IntegrationStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const providerKeys = PROVIDERS.map((p) => p.key);

    const [integrationsRes, syncRunsRes] = await Promise.all([
      supabase.from("integrations").select("*").in("provider", providerKeys),
      supabase.from("sync_runs").select("*").in("provider", providerKeys).order("started_at", { ascending: false }),
    ]);

    const err = integrationsRes.error ?? syncRunsRes.error ?? null;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const integrationByProvider = new Map<string, IntegrationRow>();
    for (const row of integrationsRes.data ?? []) integrationByProvider.set(row.provider, row);

    // sync_runs comes back started_at desc — the first row seen per provider
    // is its latest run.
    const latestRunByProvider = new Map<string, SyncRunRow>();
    for (const row of syncRunsRes.data ?? []) {
      if (!latestRunByProvider.has(row.provider)) latestRunByProvider.set(row.provider, row);
    }

    setItems(
      PROVIDERS.map(({ key, label }) =>
        buildItem(key, label, integrationByProvider.get(key), latestRunByProvider.get(key)),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
