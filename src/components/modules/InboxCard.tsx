import { Card } from "@/components/primitives/Card";
import { EmptyState } from "@/components/primitives/EmptyState";

export function InboxCard() {
  return (
    <Card num="12" title="INBOX">
      <EmptyState caption="Connect Gmail in 1B" />
    </Card>
  );
}
