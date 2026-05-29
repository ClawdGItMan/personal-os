"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Viewport switch. Server + first client render = mobile (smaller payload, no hydration
 * mismatch); after mount, matchMedia swaps to the web shell on >=1024px. Per spec §5.2,
 * the two shells are materially different IA, so we swap shells rather than restyle.
 */
export function AppShell({ web, mobile }: { web: ReactNode; mobile: ReactNode }) {
  const [isWeb, setIsWeb] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWeb(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return <>{isWeb ? web : mobile}</>;
}
