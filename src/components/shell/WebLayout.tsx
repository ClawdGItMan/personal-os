import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { LeftRail } from "./LeftRail";
import { AgentRail } from "./AgentRail";
import type { Operator } from "@/lib/types";

export function WebLayout({ operator, children }: { operator: Operator; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--os-bg)]">
      <TopBar operator={operator} />
      <main
        className="grid gap-3 px-3 pb-6"
        style={{ gridTemplateColumns: "280px minmax(0, 1fr) 340px" }}
      >
        <aside className="flex flex-col gap-3 pt-3">
          <LeftRail operator={operator} />
        </aside>
        <section className="flex flex-col gap-3 pt-3 min-w-0">{children}</section>
        <aside className="pt-3">
          <AgentRail />
        </aside>
      </main>
    </div>
  );
}
