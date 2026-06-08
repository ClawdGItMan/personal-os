"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { disconnectAppleHealth, regenerateAppleHealthToken } from "./_actions/connections";

const INGEST_URL = "https://personal-os-azure-eight.vercel.app/api/apple-health/ingest";

type Props = {
  /** Whether an integrations row exists (any status). */
  hasToken: boolean;
  /** True when `last_synced_at` is non-null. */
  connected: boolean;
  /** Pre-formatted "ago" label (e.g. "5m"), computed server-side to avoid a
   *  hydration mismatch from a clock call during this client component's render. */
  syncedLabel: string | null;
};

/** Status label + colour per connection state (sage / honey / rust). */
function getStatusMeta(
  hasToken: boolean,
  connected: boolean,
): { label: string; color: string } {
  if (!hasToken) return { label: "NOT CONNECTED", color: "var(--os-fg-4)" };
  if (!connected) return { label: "TOKEN SET", color: "var(--os-honey)" };
  return { label: "CONNECTED", color: "var(--os-accent)" };
}

export function AppleHealthConnectionRow({ hasToken, connected, syncedLabel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusMeta = getStatusMeta(hasToken, connected);

  function handleGenerate() {
    setActionError(null);
    startTransition(async () => {
      const result = await regenerateAppleHealthToken();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setOneTimeToken(result.token);
      setCopied(false);
      router.refresh();
    });
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect Apple Health? Your ingest token will be revoked and push data will stop arriving.",
      )
    )
      return;
    startTransition(async () => {
      const result = await disconnectAppleHealth();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setOneTimeToken(null);
      router.refresh();
    });
  }

  function handleCopy() {
    if (!oneTimeToken) return;
    void navigator.clipboard.writeText(oneTimeToken).then(() => {
      setCopied(true);
    });
  }

  function handleDismiss() {
    setOneTimeToken(null);
    setCopied(false);
  }

  const showGenerateButton = !hasToken || !oneTimeToken;

  return (
    <div className="border-t border-[color:var(--os-line-1)] first:border-t-0">
      <div className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-2.5">
        <span className="w-7 h-7 rounded-os-inner bg-[color:var(--os-bg-3)] flex items-center justify-center font-mono text-[10px] uppercase text-[color:var(--os-fg-3)]">
          AH
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm text-[color:var(--os-fg-1)]">Apple Health</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
            APPLE HEALTH
            {connected && syncedLabel ? ` · SYNCED ${syncedLabel} AGO` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-mono os-tnum text-[11px]"
            style={{ color: statusMeta.color }}
          >
            {statusMeta.label}
          </span>
          {showGenerateButton && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="rounded-os-inner border border-[color:var(--os-line-1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-2)] hover:text-[color:var(--os-fg-1)] disabled:opacity-50"
            >
              {isPending ? "…" : hasToken ? "Regenerate" : "Generate token"}
            </button>
          )}
          {hasToken && (
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

      {/* One-time token reveal panel */}
      {oneTimeToken && (
        <div className="mb-3 rounded-os-inner bg-[color:var(--os-bg-3)] border border-[color:var(--os-honey)] p-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-honey)]">
            Copy now — shown once. Paste into Health Auto Export.
          </p>
          <div className="space-y-1">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
                Ingest URL
              </span>
              <div className="font-mono text-[10px] text-[color:var(--os-fg-2)] break-all">
                {INGEST_URL}
              </div>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
                Authorization header
              </span>
              <div className="font-mono text-[10px] text-[color:var(--os-fg-2)] break-all">
                Bearer {oneTimeToken}
              </div>
            </div>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
            In HAE: Automations → REST API → URL + Headers → Authorization
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-os-inner border border-[color:var(--os-line-1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-2)] hover:text-[color:var(--os-fg-1)]"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-os-inner border border-[color:var(--os-line-1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-3)] hover:text-[color:var(--os-fg-1)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-rust)]">
          Error: {actionError}
        </p>
      )}
    </div>
  );
}
