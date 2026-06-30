import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type TabKey = "home" | "body" | "money" | "focus";

/**
 * A tappable item that opens the shared Detail page (spec §5.5). Events and
 * tasks both flow through here; `kind` lets the Detail template flex by type.
 * Screen agents pass whatever extra fields their detail view needs — this is
 * deliberately open (`[key: string]: unknown`) so rows don't all need the same
 * shape, while `kind`/`title` are the always-present contract.
 */
export type DetailItem = {
  kind: "event" | "task";
  title: string;
  [key: string]: unknown;
};

export type Overlay = null | { kind: "capture" } | { kind: "detail"; item: DetailItem };

export type NavValue = {
  /** The active primary tab (drives which screen renders). */
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  /** The overlay rendered above the active screen + nav, or null. */
  overlay: Overlay;
  /** Open the ⊕ Capture sheet over the current screen. */
  openCapture: () => void;
  /** Open the shared Detail page for a tapped event/task row. */
  openDetail: (item: DetailItem) => void;
  /** Dismiss whatever overlay is open. */
  close: () => void;
};

const NavContext = createContext<NavValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const openCapture = useCallback(() => setOverlay({ kind: "capture" }), []);
  const openDetail = useCallback((item: DetailItem) => setOverlay({ kind: "detail", item }), []);
  const close = useCallback(() => setOverlay(null), []);

  const value = useMemo<NavValue>(
    () => ({ tab, setTab, overlay, openCapture, openDetail, close }),
    [tab, overlay, openCapture, openDetail, close],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

/** Access the navigation state. Must be called under <NavProvider>. */
export function useNav(): NavValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within <NavProvider>");
  return ctx;
}
