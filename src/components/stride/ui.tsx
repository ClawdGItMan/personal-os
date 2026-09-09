"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Barbell,
  Check,
  Coffee,
  PersonSimpleRun,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import type { Session } from "@/lib/stride/types";

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`stride-mark ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <path d="M6 25 17 8h8L14 25H6Z" fill="currentColor" />
        <path d="m19 25 10-15 4 6-6 9h-8Z" fill="currentColor" />
      </svg>
    </span>
  );
}
export function CoachMark() {
  return (
    <span className="coach-mark">
      <Sparkle weight="fill" size={23} />
    </span>
  );
}
export function SectionTitle({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail?: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function SessionIcon({
  kind,
  size = 20,
}: {
  kind: Session["kind"];
  size?: number;
}) {
  const Icon =
    kind === "Strength"
      ? Barbell
      : kind === "Rest day"
        ? Coffee
        : PersonSimpleRun;
  return <Icon size={size} weight="regular" />;
}
export function Tag({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Progress({
  value,
  max,
  tone = "green",
}: {
  value: number;
  max: number;
  tone?: string;
}) {
  return (
    <div
      className={`progress-track ${tone}`}
      role="progressbar"
      aria-label="Progress toward target"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100))}%`,
        }}
      />
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  close,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`stride-dialog ${wide ? "wide" : ""}`}
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="stride-empty">
      <span className="empty-icon">
        <PersonSimpleRun size={30} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <button className="button primary" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function MiniRoute({ variant = 0 }: { variant?: number }) {
  const paths = [
    "M18 50 31 37 37 14 55 10 67 28 83 30 76 53 56 64 35 59 18 50Z",
    "M18 45 27 15 51 11 65 20 80 42 66 61 42 61 32 44 48 35 62 42",
    "M15 56 27 22 44 13 70 21 79 41 61 61 32 60 15 56Z",
  ];
  return (
    <svg viewBox="0 0 96 76" className="mini-route" aria-hidden="true">
      <path
        d="M0 21h96M0 43h96M0 64h96M23 0v76M50 0v76M77 0v76"
        stroke="#dfe4d9"
        strokeWidth="1"
      />
      <path
        d={paths[variant % 3]}
        fill="none"
        stroke="#758451"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="18"
        cy={variant % 3 === 1 ? 45 : variant % 3 === 2 ? 56 : 50}
        r="4"
        fill="#758451"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <span className="success-label">
      <Check size={14} weight="bold" />
      {children}
    </span>
  );
}
