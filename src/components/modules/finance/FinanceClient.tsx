"use client";

import { useState, useTransition } from "react";
import { addAccount, updateBalance } from "@/app/(app)/_actions/finance";
import { FIELD, BTN, ERR } from "@/components/modules/_field";

const TYPES = ["BANK", "HYSA", "EQUITY", "RETIRE", "CRYPTO", "PRIVATE", "T_BILLS"] as const;
type AccountType = (typeof TYPES)[number];
export type Account = { id: string; name: string; type: string; value: number };

function AccountRow({ account }: { account: Account }) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState(String(account.value));
  const dirty = Number(val) !== account.value && val.trim() !== "";

  function onSave() {
    const value = Number(val);
    if (!Number.isFinite(value) || value < 0) return;
    startTransition(async () => {
      await updateBalance({ id: account.id, value });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[color:var(--os-fg-1)] truncate">{account.name}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)]">
          {account.type}
        </div>
      </div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        inputMode="decimal"
        aria-label={`${account.name} balance`}
        disabled={pending}
        className={`${FIELD} w-24 text-right`}
      />
      {dirty && (
        <button type="button" onClick={onSave} disabled={pending} className={BTN}>
          Save
        </button>
      )}
    </div>
  );
}

export function FinanceClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("BANK");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setError("");
    startTransition(async () => {
      const res = await addAccount({ name: n, type, current_value: Number(value) || 0 });
      if (res.ok) {
        setName("");
        setValue("");
        setAdding(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-3">
      {initialAccounts.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {initialAccounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </div>
      )}

      {adding ? (
        <form onSubmit={onAdd} className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name"
            aria-label="Account name"
            disabled={pending}
            className={FIELD}
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              aria-label="Account type"
              disabled={pending}
              className={FIELD}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              placeholder="Value"
              aria-label="Account value"
              disabled={pending}
              className={`${FIELD} flex-1`}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={BTN}>
              Add account
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-2)]"
            >
              Cancel
            </button>
          </div>
          {error && <div className={ERR}>{error}</div>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full py-1.5 rounded-os-inner border border-dashed border-[color:var(--os-line-2)] font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--os-fg-4)] hover:text-[color:var(--os-fg-2)] hover:border-[color:var(--os-line-3)] transition-colors"
        >
          + Add account
        </button>
      )}
    </div>
  );
}
