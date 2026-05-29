import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function TrainCard() {
  return (
    <Card num="10" title="TRAINING">
      <EmptyState caption="No sessions" />
    </Card>
  );
}
