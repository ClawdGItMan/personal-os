"use client";

import { useState, useTransition } from "react";
import { logLift } from "@/app/(app)/_actions/training";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

export function LiftForm({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const exercise = name.trim();
    if (!exercise) return;
    setError("");
    startTransition(async () => {
      const res = await logLift({
        session_id: sessionId,
        name: exercise,
        weight: Number(weight) || 0,
        reps: Number(reps) || 0,
        sets: Number(sets) || 1,
      });
      if (res.ok) {
        setName("");
        setWeight("");
        setReps("");
        setSets("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise…"
        aria-label="Exercise"
        disabled={pending}
        className={FIELD}
      />
      <div className="grid grid-cols-3 gap-2">
        <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="Weight" aria-label="Weight" disabled={pending} className={FIELD} />
        <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="Reps" aria-label="Reps" disabled={pending} className={FIELD} />
        <input value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" placeholder="Sets" aria-label="Sets" disabled={pending} className={FIELD} />
      </div>
      <button type="submit" disabled={pending} className={BTN}>
        Log lift
      </button>
      {error && <div className={ERR}>{error}</div>}
    </form>
  );
}
