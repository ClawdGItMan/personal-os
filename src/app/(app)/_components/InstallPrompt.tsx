"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "os-install-dismissed";

/**
 * One-time iOS install hint. iOS Safari has no `beforeinstallprompt`, so we detect
 * iOS + not-already-installed + not-dismissed and show share-sheet instructions.
 * Renders null on the server and on every non-iOS / standalone / dismissed surface.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (!isIOS || dismissed) return;
    // Subscribe to display-mode (mirrors AppShell): show while not installed, hide on install.
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () => setShow(!(mq.matches || nav.standalone === true));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Personal OS"
      className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-os-card border border-[color:var(--os-line-2)] bg-[color:var(--os-bg-2)] p-3"
    >
      <p className="flex-1 font-mono text-[11px] leading-relaxed text-[color:var(--os-fg-2)]">
        Add Personal OS to your home screen — tap Share, then Add to Home Screen.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-os-inner border border-[color:var(--os-line-2)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--os-fg-3)] hover:text-[color:var(--os-fg-1)] focus-visible:outline-none focus-visible:border-[color:var(--os-accent)]"
      >
        Dismiss
      </button>
    </div>
  );
}
