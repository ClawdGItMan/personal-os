import { redirect } from "next/navigation";
import { getOperator } from "@/lib/operator";
import { ConnectionBanner } from "@/components/primitives/ConnectionBanner";
import { SessionCard } from "@/components/modules/SessionCard";
import { FinancePulseCard } from "@/components/modules/FinancePulseCard";
import { TasksCard } from "@/components/modules/TasksCard";
import { HabitsCard } from "@/components/modules/HabitsCard";
import { CalendarCard } from "@/components/modules/CalendarCard";
import { NutritionCard } from "@/components/modules/NutritionCard";
import { HealthCard } from "@/components/modules/HealthCard";
import { SocialCard } from "@/components/modules/SocialCard";
import { TrainCard } from "@/components/modules/TrainCard";
import { InboxCard } from "@/components/modules/InboxCard";

export default async function DashboardPage() {
  const operator = await getOperator();
  if (!operator) redirect("/login");

  return (
    <>
      <ConnectionBanner />
      <SessionCard first={operator.first} timezone={operator.timezone} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FinancePulseCard />
        <TasksCard />
      </div>
      <HabitsCard />
      <CalendarCard />
      <div className="grid gap-3 sm:grid-cols-3">
        <NutritionCard />
        <HealthCard />
        <SocialCard />
      </div>
      <TrainCard />
      <InboxCard />
    </>
  );
}
