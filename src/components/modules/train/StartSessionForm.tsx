"use client";

import { useState, useTransition } from "react";
import { startSession } from "@/app/(app)/_actions/training";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

export function StartSessionForm() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setError("");
    startTransition(async () => {
      const res = await startSession({ split_name: value });
      if (res.ok) setName("");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Start a session (e.g. Push)…"
        aria-label="Session name"
        disabled={pending}
        className={`${FIELD} flex-1`}
      />
      <button type="submit" disabled={pending} className={BTN}>
        Start
      </button>
      {error && <div className={`${ERR} w-full`}>{error}</div>}
    </form>
  );
}
