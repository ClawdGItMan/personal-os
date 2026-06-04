import Link from "next/link";

import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard banner shown when any integration has lapsed (`expired`/`error`),
 * e.g. after Google revokes access or a sync fails. Renders nothing when all
 * connections are healthy. Links to Settings, where the user can reconnect.
 */
export async function ConnectionBanner() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", userId)
    .in("status", ["expired", "error"]);

  if (!data || data.length === 0) return null;

  const providers = data.map((row) => row.provider.toUpperCase()).join(" · ");

  return (
    <Link
      href="/settings"
      className="block rounded-os-card border border-[color:var(--os-honey)] bg-[color:var(--os-bg-2)] px-4 py-3 transition-colors hover:bg-[color:var(--os-bg-3)]"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-honey)]">
        ⚠ {providers} · RECONNECT
      </span>
    </Link>
  );
}
