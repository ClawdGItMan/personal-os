import type { ReactNode } from "react";
import { MobileTopBar } from "./MobileTopBar";
import { BottomNav } from "./BottomNav";

export function MobileLayout({ initials, children }: { initials: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--os-bg)]">
      <MobileTopBar initials={initials} />
      <div
        className="flex-1 os-noscroll overflow-y-auto px-4 pt-3"
        style={{ paddingBottom: "100px" }}
      >
        <div className="flex flex-col gap-3">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
