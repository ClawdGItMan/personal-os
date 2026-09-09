"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import { initialState } from "@/lib/stride/demo";
import { workspaceSchema } from "@/lib/stride/schema";
import { dayKey, mergeRuns, suggestAdjustment } from "@/lib/stride/training";
import type { CheckIn, Run, StrideState, View } from "@/lib/stride/types";

type Status = {
  aiConfigured: boolean;
  stravaConfigured: boolean;
  stravaConnected: boolean;
};
type Context = {
  state: StrideState;
  setState: Dispatch<SetStateAction<StrideState | null>>;
  view: View;
  navigate: (view: View) => void;
  toast: (message: string) => void;
  notice: string;
  status: Status;
  refreshStatus: () => Promise<void>;
  addRuns: (runs: Run[], health?: boolean) => void;
  saveCheckin: (checkin: CheckIn) => void;
  acceptAdjustment: (id: string) => void;
  dismissAdjustment: (id: string) => void;
};
const StrideContext = createContext<Context | null>(null);
const views: View[] = [
  "Overview",
  "Training plan",
  "Activities",
  "AI coach",
  "Nutrition",
  "Strength & recovery",
  "Connections",
  "Settings",
];
const slug = (view: View) =>
  view.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-");
export const STORAGE_KEY = "stride.workspace.v1";

export function StrideProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StrideState | null>(null);
  const [view, setView] = useState<View>("Overview");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<Status>({
    aiConfigured: false,
    stravaConfigured: false,
    stravaConnected: false,
  });
  const toast = useCallback((message: string) => setNotice(message), []);
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/stride/status");
      if (response.ok) setStatus(await response.json());
    } catch {
      /* Offline tracking stays available. */
    }
  }, []);
  useEffect(() => {
    const hydrate = () => {
      let saved: StrideState | null = null;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const result = workspaceSchema.safeParse(JSON.parse(raw));
          if (result.success) saved = result.data;
          else throw new Error("Unsupported saved workspace");
        }
      } catch {
        let recovered = false;
        if (raw) {
          try {
            localStorage.setItem(`${STORAGE_KEY}.recovery`, raw);
            recovered = true;
          } catch {
            /* Storage itself may be unavailable or full. */
          }
        }
        setNotice(
          recovered
            ? "Your saved workspace could not be loaded. A recovery copy was kept in browser storage; a demo is shown for now."
            : "Browser storage could not be read. A demo is shown; export a backup if storage remains unavailable.",
        );
      }
      setState(saved || initialState());
      const selected = views.find(
        (v) => slug(v) === window.location.hash.slice(1),
      );
      if (selected) setView(selected);
      const connection = new URLSearchParams(location.search).get("connection");
      if (connection) {
        setView("Connections");
        setNotice(
          connection === "strava-connected"
            ? "Strava connected. Sync your runs to bring them into Stride."
            : connection === "strava-setup"
              ? "Strava needs its app credentials configured before connecting."
              : connection === "strava-canceled"
                ? "Connection canceled. You can connect again whenever you’re ready."
                : "Strava could not connect. Please try again and grant permission to read activities.",
        );
        history.replaceState(null, "", "/stride#connections");
      }
    };
    queueMicrotask(() => {
      hydrate();
      void refreshStatus();
    });
    const onHash = () =>
      setView(
        views.find((v) => slug(v) === window.location.hash.slice(1)) ||
          "Overview",
      );
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [refreshStatus]);
  useEffect(() => {
    if (state)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        queueMicrotask(() =>
          setNotice(
            "Storage is full or unavailable. Export a backup in Settings; changes may not persist.",
          ),
        );
      }
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const navigate = (next: View) => {
    setView(next);
    location.hash = slug(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addRuns = (runs: Run[], health = false) => {
    setState((previous) => {
      if (!previous) return previous;
      const realRuns = runs.some((r) => r.source !== "Demo");
      const base =
        realRuns && previous.demo
          ? { ...initialState(false), profile: previous.profile }
          : previous;
      const next = {
        ...base,
        runs: mergeRuns(base.runs, runs),
        healthImportedAt: health
          ? new Date().toISOString()
          : base.healthImportedAt,
      };
      const adjustment = suggestAdjustment(next, runs[0]);
      if (adjustment)
        next.adjustments = [
          adjustment,
          ...next.adjustments.map((a) =>
            a.status === "pending" && a.sessionId === adjustment.sessionId
              ? { ...a, status: "dismissed" as const }
              : a,
          ),
        ];
      return next;
    });
  };
  const saveCheckin = (checkin: CheckIn) => {
    setState((previous) => {
      if (!previous) return previous;
      const next = {
        ...previous,
        checkins: [
          checkin,
          ...previous.checkins.filter((c) => c.date !== dayKey()),
        ],
      };
      const suggestion = suggestAdjustment(next, undefined, checkin);
      if (suggestion)
        next.adjustments = [
          suggestion,
          ...next.adjustments.map((a) =>
            a.status === "pending" && a.sessionId === suggestion.sessionId
              ? { ...a, status: "dismissed" as const }
              : a,
          ),
        ];
      return next;
    });
    toast("Check-in saved. Your next session has been reviewed.");
  };
  const acceptAdjustment = (id: string) => {
    setState((previous) => {
      if (!previous) return previous;
      const adjustment = previous.adjustments.find((a) => a.id === id);
      if (!adjustment) return previous;
      return {
        ...previous,
        overrides: {
          ...previous.overrides,
          [adjustment.sessionId]: adjustment.after,
        },
        adjustments: previous.adjustments.map((a) =>
          a.id === id ? { ...a, status: "accepted" } : a,
        ),
      };
    });
    toast("Your plan has been updated. Recovery is progress, too.");
  };
  const dismissAdjustment = (id: string) => {
    setState((previous) =>
      previous
        ? {
            ...previous,
            adjustments: previous.adjustments.map((a) =>
              a.id === id ? { ...a, status: "dismissed" } : a,
            ),
          }
        : previous,
    );
    toast("Suggestion dismissed.");
  };
  if (!state)
    return (
      <div className="stride-loading">
        <div className="stride-wordmark">
          stride<span>↗</span>
        </div>
        <p>Finding your rhythm…</p>
        <div className="loading-line" />
      </div>
    );
  return (
    <StrideContext.Provider
      value={{
        state,
        setState,
        view,
        navigate,
        toast,
        notice,
        status,
        refreshStatus,
        addRuns,
        saveCheckin,
        acceptAdjustment,
        dismissAdjustment,
      }}
    >
      {children}
    </StrideContext.Provider>
  );
}
export function useStride() {
  const context = useContext(StrideContext);
  if (!context) throw new Error("Stride context is missing");
  return context;
}
