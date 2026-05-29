"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OperatorCard } from "@/components/modules/OperatorCard";
import { Card } from "@/components/primitives/Card";
import { WEB_TABS } from "@/lib/nav";
import type { Operator } from "@/lib/types";

/**
 * Web left rail: operator identity + quick-switch nav. Primary modules (Finance, Tasks)
 * live in the shared center stack so they reach the mobile shell too (shells are swapped,
 * not restyled, so web-only chrome is invisible on mobile).
 */
export function LeftRail({ operator }: { operator: Operator }) {
  const pathname = usePathname();

  return (
    <>
      <OperatorCard operator={operator} />

      <Card title="QUICK SWITCH">
        <nav className="flex flex-col gap-1">
          {WEB_TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-2 py-1.5 rounded-os-inner font-mono text-[11px] uppercase tracking-[0.1em] ${
                  active
                    ? "bg-[color:var(--os-bg-3)] text-[color:var(--os-fg-1)]"
                    : "text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-2)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </Card>
    </>
  );
}
