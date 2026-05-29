"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/(app)/_actions/profile";
import { FIELD, BTN, ERR } from "@/components/modules/_field";
import type { Operator } from "@/lib/types";

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
};

function Field({ id, label, value, onChange, disabled }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)] mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={FIELD}
      />
    </div>
  );
}

export function ProfileForm({ operator }: { operator: Operator }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(operator.name);
  const [role, setRole] = useState(operator.role);
  const [location, setLocation] = useState(operator.location);
  const [focus, setFocus] = useState(operator.focus);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfile({ name, role, location, focus });
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
      <Field id="profile-name" label="Name" value={name} onChange={setName} disabled={pending} />
      <Field id="profile-role" label="Role" value={role} onChange={setRole} disabled={pending} />
      <Field
        id="profile-location"
        label="Location"
        value={location}
        onChange={setLocation}
        disabled={pending}
      />
      <Field id="profile-focus" label="Focus" value={focus} onChange={setFocus} disabled={pending} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN}>
          Save
        </button>
        {saved && !error && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--os-accent)]">
            {"✓ SAVED"}
          </span>
        )}
      </div>
      {error && <p className={ERR}>{error}</p>}
    </form>
  );
}
