"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-[color:var(--os-line-1)]"
      style={{
        background: "color-mix(in srgb, var(--os-bg) 80%, transparent)",
        backdropFilter: "blur(20px)",
        paddingBottom: "24px",
      }}
    >
      {MOBILE_TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center gap-1 py-2">
            <span
              className={`text-base leading-none ${
                active ? "text-[color:var(--os-accent)]" : "text-[color:var(--os-fg-4)]"
              }`}
            >
              {t.icon}
            </span>
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
                active ? "text-[color:var(--os-fg-1)]" : "text-[color:var(--os-fg-5)]"
              }`}
            >
              {t.mobileLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
