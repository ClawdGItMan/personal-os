import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function SocialCard() {
  return (
    <Card num="09" title="SOCIAL">
      <EmptyState caption="No followers tracked" />
    </Card>
  );
}
