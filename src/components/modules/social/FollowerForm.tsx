"use client";

import { useState, useTransition } from "react";
import { logFollowers } from "@/app/(app)/_actions/social";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

const PLATFORMS = ["X", "LINKEDIN", "SUBSTACK", "GITHUB", "IG"] as const;

export function FollowerForm() {
  const [pending, startTransition] = useTransition();
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("X");
  const [count, setCount] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    setError("");
    startTransition(async () => {
      const res = await logFollowers({ platform, count: Math.round(n) });
      if (res.ok) setCount("");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2 flex-wrap">
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
        aria-label="Platform"
        disabled={pending}
        className={FIELD}
      >
        {PLATFORMS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        value={count}
        onChange={(e) => setCount(e.target.value)}
        inputMode="numeric"
        placeholder="Follower count"
        aria-label="Follower count"
        disabled={pending}
        className={`${FIELD} flex-1`}
      />
      <button type="submit" disabled={pending} className={BTN}>
        Log
      </button>
      {error && <div className={`${ERR} w-full`}>{error}</div>}
    </form>
  );
}
