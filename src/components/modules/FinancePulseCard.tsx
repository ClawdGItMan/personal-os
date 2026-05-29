import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function FinancePulseCard() {
  return (
    <Card num="03" title="FINANCE PULSE" meta="30D">
      <EmptyState caption="No accounts yet" />
    </Card>
  );
}
