"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { disconnectGoogle, syncGoogleNow } from "./_actions/connections";

type Props = {
  status: string | null;
  /** Pre-formatted "ago" label (e.g. "5m"), computed server-side to avoid a
   *  hydration mismatch from a clock call during this client component's render. */
  syncedLabel: string | null;
  lastError: string | null;
};

/** Status label + colour per connection state (sage / honey / rust). */
const META: Record<string, { label: string; color: string }> = {
  connected: { label: "CONNECTED", color: "var(--os-accent)" },
  expired: { label: "RECONNECT", color: "var(--os-honey)" },
  error: { label: "ERROR", color: "var(--os-rust)" },
};

export function GoogleConnectionRow({ status, syncedLabel, lastError }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const triggered = useRef(false);

  // Returning from Google sets ?connected=google — kick an immediate sync so the
  // dashboard populates right away, then strip the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "google" || triggered.current) return;
    triggered.current = true;
    setSyncing(true);
    void syncGoogleNow().finally(() => {
      setSyncing(false);
      window.history.replaceState(null, "", "/settings");
      router.refresh();
    });
  }, [router]);

  const meta = status ? META[status] : null;
  const isConnected = Boolean(status);

  function handleDisconnect() {
    if (!window.confirm("Disconnect Google? Your calendar will stop syncing.")) return;
    startTransition(async () => {
      await disconnectGoogle();
      router.refresh();
    });
  }

  const valueLabel = syncing ? "SYNCING…" : (meta?.label ?? "NOT CONNECTED");
  const valueColor = syncing ? "var(--os-fg-3)" : (meta?.color ?? "var(--os-fg-4)");

  return (
    <div className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-2.5 border-t border-[color:var(--os-line-1)] first:border-t-0">
      <span className="w-7 h-7 rounded-os-inner bg-[color:var(--os-bg-3)] flex items-center justify-center font-mono text-[10px] uppercase text-[color:var(--os-fg-3)]">
        GO
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm text-[color:var(--os-fg-1)]">Google</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
          CALENDAR
          {status === "connected" && syncedLabel ? ` · SYNCED ${syncedLabel} AGO` : ""}
          {status === "error" && lastError ? " · SYNC ERROR" : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono os-tnum text-[11px]" style={{ color: valueColor }}>
          {valueLabel}
        </span>
        {!isConnected && (
          <a
            href="/api/google/connect"
            className="rounded-os-inner border border-[color:var(--os-line-1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-2)] hover:text-[color:var(--os-fg-1)]"
          >
            Connect
          </a>
        )}
        {isConnected && status !== "connected" && (
          <a
            href="/api/google/connect"
            className="rounded-os-inner border border-[color:var(--os-honey)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-honey)]"
          >
            Reconnect
          </a>
        )}
        {isConnected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            className="rounded-os-inner border border-[color:var(--os-line-1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-3)] hover:text-[color:var(--os-rust)] disabled:opacity-50"
          >
            {isPending ? "…" : "Disconnect"}
          </button>
        )}
      </div>
    </div>
  );
}
