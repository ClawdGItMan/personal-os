import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function HabitsCard() {
  return (
    <Card num="05" title="HABITS" meta="0 / 0">
      <EmptyState caption="No habits yet" />
    </Card>
  );
}
