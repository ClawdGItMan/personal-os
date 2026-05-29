"use client";

import { useState, useTransition } from "react";
import { logMeal } from "@/app/(app)/_actions/nutrition";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

export function MealForm() {
  const [pending, startTransition] = useTransition();
  const [desc, setDesc] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const description = desc.trim();
    if (!description) return;
    setError("");
    startTransition(async () => {
      const res = await logMeal({
        description,
        kcal: Number(kcal) || 0,
        protein_g: Number(p) || 0,
        carbs_g: Number(c) || 0,
        fat_g: Number(f) || 0,
      });
      if (res.ok) {
        setDesc("");
        setKcal("");
        setP("");
        setC("");
        setF("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Log a meal…"
        aria-label="Meal description"
        disabled={pending}
        className={FIELD}
      />
      <div className="grid grid-cols-4 gap-2">
        <input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder="kcal" aria-label="kcal" disabled={pending} className={FIELD} />
        <input value={p} onChange={(e) => setP(e.target.value)} inputMode="numeric" placeholder="P" aria-label="protein grams" disabled={pending} className={FIELD} />
        <input value={c} onChange={(e) => setC(e.target.value)} inputMode="numeric" placeholder="C" aria-label="carbs grams" disabled={pending} className={FIELD} />
        <input value={f} onChange={(e) => setF(e.target.value)} inputMode="numeric" placeholder="F" aria-label="fat grams" disabled={pending} className={FIELD} />
      </div>
      <button type="submit" disabled={pending} className={BTN}>
        Log meal
      </button>
      {error && <div className={ERR}>{error}</div>}
    </form>
  );
}
