import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getOperator } from "@/lib/operator";
import { AppShell } from "@/components/shell/AppShell";
import { WebLayout } from "@/components/shell/WebLayout";
import { MobileLayout } from "@/components/shell/MobileLayout";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const operator = await getOperator();
  if (!operator) redirect("/login");

  return (
    <AppShell
      web={<WebLayout operator={operator}>{children}</WebLayout>}
      mobile={<MobileLayout>{children}</MobileLayout>}
    />
  );
}
