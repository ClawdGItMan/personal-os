"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addHabit, toggleHabitToday } from "@/app/(app)/_actions/habits";

export type HabitRow = { id: string; name: string; sub: string; done: boolean };

type Action = { type: "toggle"; id: string } | { type: "add"; habit: HabitRow };

export function HabitsClient({ initialHabits }: { initialHabits: HabitRow[] }) {
  const [, startTransition] = useTransition();
  const [habits, applyOptimistic] = useOptimistic<HabitRow[], Action>(initialHabits, (state, action) =>
    action.type === "add"
      ? [...state, action.habit]
      : state.map((h) => (h.id === action.id ? { ...h, done: !h.done } : h)),
  );
  const [name, setName] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setName("");
    startTransition(async () => {
      applyOptimistic({ type: "add", habit: { id: crypto.randomUUID(), name: value, sub: "", done: false } });
      await addHabit({ name: value, sub_label: "" });
    });
  }

  function onToggle(h: HabitRow) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: h.id });
      await toggleHabitToday({ habitId: h.id, done: !h.done });
    });
  }

  return (
    <div>
      {habits.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onToggle(h)}
              aria-pressed={h.done}
              className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-os-inner border text-left transition-colors ${
                h.done
                  ? "bg-[color:var(--os-accent-soft)] border-[color:var(--os-accent-dim)]"
                  : "bg-[color:var(--os-bg-3)] border-[color:var(--os-line-2)] hover:border-[color:var(--os-line-3)]"
              }`}
            >
              <span
                className={`text-sm ${h.done ? "text-[color:var(--os-accent)]" : "text-[color:var(--os-fg-1)]"}`}
              >
                {h.name}
              </span>
              {h.sub && (
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)]">
                  {h.sub}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onAdd} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a habit…"
          aria-label="Add a habit"
          className="flex-1 px-2.5 py-1.5 bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-inner text-sm text-[color:var(--os-fg-1)] placeholder:text-[color:var(--os-fg-5)] focus:outline-none focus:border-[color:var(--os-accent)]"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-os-inner text-xs font-medium"
        >
          Add
        </button>
      </form>
    </div>
  );
}
