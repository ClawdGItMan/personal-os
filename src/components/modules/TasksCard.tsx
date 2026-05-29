import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function TasksCard() {
  return (
    <Card num="04" title="TODAY · KEY" meta="0 DUE">
      <EmptyState caption="No tasks yet" />
    </Card>
  );
}
