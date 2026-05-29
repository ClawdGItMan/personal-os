import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function NutritionCard() {
  return (
    <Card num="07" title="NUTRITION">
      <EmptyState caption="No meals logged" />
    </Card>
  );
}
