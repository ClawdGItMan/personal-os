import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOperator } from "@/lib/operator";
import { getGoogleIntegration } from "@/lib/integrations/store";
import { isStale, staleAgeLabel } from "@/lib/sync/stale";
import { nowISO } from "@/lib/format";
import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";
import { CalendarList, type CalendarListEvent } from "./calendar/CalendarList";

export async function CalendarCard() {
  const userId = await getCurrentUserId();
  const supabase = await createClient();
  const operator = await getOperator();
  const timeZone = operator?.timezone?.trim() || "UTC";

  // Next ~week of upcoming events (RLS scopes to the signed-in user).
  const { data: events } = await supabase
    .from("calendar_events")
    .select("title, location, starts_at, all_day")
    .gte("starts_at", nowISO())
    .order("starts_at", { ascending: true })
    .limit(8);

  const integration = userId ? await getGoogleIntegration(supabase, userId) : null;
  const stale = integration ? isStale(integration.last_synced_at) : false;
  const meta =
    integration && stale ? `⚠ STALE · ${staleAgeLabel(integration.last_synced_at)}` : undefined;

  const rows = (events ?? []) as CalendarListEvent[];
  const emptyCaption = integration ? "No upcoming events" : "Connect Google in Settings";

  return (
    <Card num="06" title="CALENDAR" meta={meta}>
      {rows.length > 0 ? (
        <CalendarList events={rows} timeZone={timeZone} />
      ) : (
        <EmptyState caption={emptyCaption} />
      )}
    </Card>
  );
}
