"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addTask, toggleTask } from "@/app/(app)/_actions/tasks";

export type TaskRow = { id: string; title: string; star: boolean };

type Action = { type: "toggle"; id: string } | { type: "add"; task: TaskRow };

export function TasksClient({ initialTasks }: { initialTasks: TaskRow[] }) {
  const [, startTransition] = useTransition();
  const [tasks, applyOptimistic] = useOptimistic<TaskRow[], Action>(initialTasks, (state, action) =>
    action.type === "toggle"
      ? state.filter((t) => t.id !== action.id)
      : [action.task, ...state],
  );
  const [title, setTitle] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle("");
    startTransition(async () => {
      applyOptimistic({ type: "add", task: { id: crypto.randomUUID(), title: value, star: false } });
      await addTask({ title: value, star: false });
    });
  }

  function onToggle(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id });
      await toggleTask({ id, done: true });
    });
  }

  return (
    <div>
      <form onSubmit={onAdd} className="flex gap-2 mb-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="Add a task"
          className="flex-1 px-2.5 py-1.5 bg-[color:var(--os-bg-3)] border border-[color:var(--os-line-2)] rounded-os-inner text-sm text-[color:var(--os-fg-1)] placeholder:text-[color:var(--os-fg-5)] focus:outline-none focus:border-[color:var(--os-accent)]"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-[color:var(--os-accent)] text-[color:var(--os-bg)] rounded-os-inner text-xs font-medium"
        >
          Add
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="py-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
          No open tasks
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-os-inner hover:bg-[color:var(--os-bg-hover)] text-left transition-colors group"
              >
                <span className="w-4 h-4 rounded-[5px] border border-[color:var(--os-line-3)] group-hover:border-[color:var(--os-accent)] flex-shrink-0 transition-colors" />
                <span className="text-sm text-[color:var(--os-fg-1)] flex-1">{t.title}</span>
                {t.star && <span className="text-[color:var(--os-honey)] text-xs">★</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
