import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function CalendarCard() {
  return (
    <Card num="06" title="CALENDAR">
      <EmptyState caption="No events" />
    </Card>
  );
}
