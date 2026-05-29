import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function HealthCard() {
  return (
    <Card num="08" title="HEALTH">
      <EmptyState caption="No health data" />
    </Card>
  );
}
