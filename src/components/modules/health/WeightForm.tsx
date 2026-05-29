"use client";

import { useState, useTransition } from "react";
import { logWeight } from "@/app/(app)/_actions/health";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

export function WeightForm() {
  const [pending, startTransition] = useTransition();
  const [w, setW] = useState("");
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(w);
    if (!weight) return;
    setError("");
    startTransition(async () => {
      const res = await logWeight({ weight, weight_unit: unit });
      if (res.ok) setW("");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2">
      <input
        value={w}
        onChange={(e) => setW(e.target.value)}
        inputMode="decimal"
        placeholder="Log weight…"
        aria-label="Weight"
        disabled={pending}
        className={`${FIELD} flex-1`}
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as "lbs" | "kg")}
        aria-label="Unit"
        disabled={pending}
        className={FIELD}
      >
        <option value="lbs">lbs</option>
        <option value="kg">kg</option>
      </select>
      <button type="submit" disabled={pending} className={BTN}>
        Log
      </button>
      {error && <div className={`${ERR} w-full`}>{error}</div>}
    </form>
  );
}
