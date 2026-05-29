"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Scrim + dialog with Esc-to-close and click-outside dismiss. Used by 1A.4 entry forms. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-card p-5"
        style={{ boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--os-fg-3)]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-1)] transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
