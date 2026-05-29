"use client";

import { useSyncExternalStore } from "react";

/**
 * Ticking wall clock as an external store. Using useSyncExternalStore (rather than
 * setState-in-effect) gives a hydration-safe read: the server snapshot and first client
 * paint both yield the sentinel (→ null), then React re-renders with the live time after
 * mount. Returns null until mounted so components can render a placeholder.
 */
let current = 0;
let listeners: Array<() => void> = [];
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void): () => void {
  listeners.push(callback);
  if (intervalId === null) {
    current = Date.now();
    listeners.forEach((l) => l());
    intervalId = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners = listeners.filter((l) => l !== callback);
    if (listeners.length === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

function getServerSnapshot(): number {
  return 0;
}

export function useClock(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === 0 ? null : new Date(ms);
}
