import { getOperator } from "@/lib/operator";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/primitives/PageHeader";
import { Card } from "@/components/primitives/Card";
import { ProfileForm } from "./ProfileForm";
import { AppearanceCard } from "./AppearanceCard";
import { ConnectionsCard } from "./ConnectionsCard";

export default async function SettingsPage() {
  const operator = await getOperator();
  if (!operator) redirect("/login");

  return (
    <>
      <PageHeader title="Settings ·" emphasis="console." sub="SYSTEM · MAX OS" />
      <Card num="01" title="OPERATOR" meta="PROFILE">
        <ProfileForm operator={operator} />
      </Card>
      <Card num="02" title="APPEARANCE" meta="THEME">
        <AppearanceCard />
      </Card>
      <Card num="03" title="CONNECTIONS" meta="PHASE 1B">
        <ConnectionsCard />
      </Card>
    </>
  );
}
