import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FinanceAccountType, MoneyAccount, MoneyGroup } from "../../lib/queries";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { formatPlainMagnitude } from "./format";
import { FieldLabel, SegmentedToggle, SheetPrimaryButton, SheetTextField } from "./MoneyFormControls";
import { MoneySheetShell } from "./MoneySheetShell";

type Sign = "asset" | "debt";

type AccountEditorSheetProps = {
  accounts: MoneyAccount[];
  onClose: () => void;
  onAddAccount: (name: string, type: FinanceAccountType, value: number) => Promise<void>;
  onUpdateValue: (id: string, value: number) => Promise<void>;
  /** Open straight into the add-account form — used by the empty-state CTA
   * where a list of zero accounts has nothing else to show. */
  initialAdding?: boolean;
};

const SIGN_OPTIONS: { value: Sign; label: string }[] = [
  { value: "asset", label: "Asset" },
  { value: "debt", label: "Debt" },
];

const ACCOUNT_TYPES: { value: FinanceAccountType; label: string }[] = [
  { value: "BANK", label: "Bank" },
  { value: "HYSA", label: "HYSA" },
  { value: "T_BILLS", label: "T-Bills" },
  { value: "EQUITY", label: "Equity" },
  { value: "RETIRE", label: "Retirement" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "PRIVATE", label: "Private" },
];

const GROUP_ORDER: MoneyGroup[] = ["cash", "invested", "debt"];
const GROUP_LABEL: Record<MoneyGroup, string> = { cash: "CASH", invested: "INVESTED", debt: "DEBT" };

/**
 * Local "Accounts" management sheet (design brief: accounts tap →
 * AccountEditorSheet, edit value + add account). Lists every account
 * grouped CASH/INVESTED/DEBT (same grouping the hook already computes —
 * `MoneyAccount.group` is trusted directly, not recomputed here); tapping a
 * row opens an inline Asset/Debt + amount editor for that one account
 * (`updateAccountValue` only mutates value, not name/type, so that's all
 * this editor exposes); a persistent "Add account" row opens a full add
 * form (name + type + opening value).
 */
export function AccountEditorSheet({
  accounts,
  onClose,
  onAddAccount,
  onUpdateValue,
  initialAdding,
}: AccountEditorSheetProps) {
  const { c, t } = useTheme();
  const [adding, setAdding] = useState(!!initialAdding);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add-account form state.
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceAccountType>("BANK");
  const [sign, setSign] = useState<Sign>("asset");
  const [magnitude, setMagnitude] = useState("");
  const [saving, setSaving] = useState(false);

  function resetAddForm() {
    setName("");
    setType("BANK");
    setSign("asset");
    setMagnitude("");
  }

  const parsedMagnitude = Number(magnitude);
  const magnitudeValid = magnitude.trim().length > 0 && Number.isFinite(parsedMagnitude) && parsedMagnitude >= 0;
  const addValid = name.trim().length > 0 && magnitudeValid;

  async function submitAdd() {
    if (!addValid || saving) return;
    setSaving(true);
    // `onAddAccount` (useMoney's addAccount) never throws — failures land in
    // the hook's shared `error` state, surfaced by MoneyScreen's retry row
    // after this closes, not here (there's no per-call success signal).
    const value = sign === "debt" ? -Math.abs(parsedMagnitude) : Math.abs(parsedMagnitude);
    await onAddAccount(name.trim(), type, value);
    setSaving(false);
    resetAddForm();
    setAdding(false);
  }

  if (adding) {
    return (
      <MoneySheetShell title="ADD ACCOUNT" onClose={onClose}>
        <FieldLabel>NAME</FieldLabel>
        <SheetTextField value={name} onChangeText={setName} placeholder="e.g. Chase Checking" autoFocus />

        <View style={styles.gap} />
        <FieldLabel>TYPE</FieldLabel>
        <SegmentedToggle options={ACCOUNT_TYPES} value={type} onChange={setType} />

        <View style={styles.gap} />
        <FieldLabel>ASSET OR DEBT</FieldLabel>
        <SegmentedToggle options={SIGN_OPTIONS} value={sign} onChange={setSign} />

        <View style={styles.gap} />
        <FieldLabel>VALUE</FieldLabel>
        <SheetTextField value={magnitude} onChangeText={setMagnitude} placeholder="0.00" keyboardType="decimal-pad" numeric />

        <View style={styles.gapLarge} />
        <SheetPrimaryButton label="Add account" onPress={submitAdd} disabled={!addValid} loading={saving} />
        {accounts.length > 0 ? (
          <Pressable
            onPress={() => {
              resetAddForm();
              setAdding(false);
            }}
            hitSlop={8}
            style={styles.cancelLink}
          >
            <Text style={[styles.cancelLinkText, { color: c.ink50 }]}>Back to accounts</Text>
          </Pressable>
        ) : null}
      </MoneySheetShell>
    );
  }

  return (
    <MoneySheetShell title="ACCOUNTS" onClose={onClose}>
      {accounts.length === 0 ? (
        <Text style={[styles.emptyText, { color: c.ink50 }]}>No accounts yet.</Text>
      ) : (
        GROUP_ORDER.map((group) => {
          const rows = accounts.filter((a) => a.group === group);
          if (rows.length === 0) return null;
          return (
            <View key={group} style={styles.groupBlock}>
              <Text style={[styles.groupLabel, { color: c.ink38 }]}>{GROUP_LABEL[group]}</Text>
              {rows.map((account) =>
                editingId === account.id ? (
                  <AccountEditRow
                    key={account.id}
                    account={account}
                    onCancel={() => setEditingId(null)}
                    onSave={async (value) => {
                      await onUpdateValue(account.id, value);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <Pressable
                    key={account.id}
                    onPress={() => setEditingId(account.id)}
                    style={[styles.accountRow, { borderTopColor: c.hairRow }]}
                  >
                    <View style={styles.accountRowLeft}>
                      <Text style={[styles.accountName, { color: c.ink }]}>{account.name}</Text>
                      <Text style={[t.statSub, styles.accountType]}>{account.type}</Text>
                    </View>
                    <Text style={[styles.accountValue, { color: account.currentValue < 0 ? c.red : c.ink }]}>
                      {account.currentValue < 0 ? "-" : ""}
                      {formatPlainMagnitude(account.currentValue)}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          );
        })
      )}

      <Pressable
        onPress={() => {
          resetAddForm();
          setAdding(true);
        }}
        style={[styles.addAccountRow, { borderColor: c.hairSection }]}
      >
        <Text style={[styles.addAccountLabel, { color: c.accent }]}>+ Add account</Text>
      </Pressable>
    </MoneySheetShell>
  );
}

type AccountEditRowProps = {
  account: MoneyAccount;
  onCancel: () => void;
  onSave: (value: number) => Promise<void>;
};

/** Inline Asset/Debt + amount editor for one account row (updateAccountValue only). */
function AccountEditRow({ account, onCancel, onSave }: AccountEditRowProps) {
  const { c } = useTheme();
  const [sign, setSign] = useState<Sign>(account.currentValue < 0 ? "debt" : "asset");
  const [magnitude, setMagnitude] = useState(String(Math.abs(account.currentValue)));
  const [saving, setSaving] = useState(false);

  const parsedMagnitude = Number(magnitude);
  const valid = magnitude.trim().length > 0 && Number.isFinite(parsedMagnitude) && parsedMagnitude >= 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    // `onSave` → useMoney's updateAccountValue never throws — see submitAdd's
    // comment above for why there's no local success/failure branch here.
    const value = sign === "debt" ? -Math.abs(parsedMagnitude) : Math.abs(parsedMagnitude);
    await onSave(value);
    setSaving(false);
  }

  return (
    <View style={[styles.editRow, { borderTopColor: c.hairRow }]}>
      <Text style={[styles.accountName, { color: c.ink }]}>{account.name}</Text>
      <View style={styles.gap} />
      <SegmentedToggle options={SIGN_OPTIONS} value={sign} onChange={setSign} />
      <View style={styles.gap} />
      <SheetTextField value={magnitude} onChangeText={setMagnitude} placeholder="0.00" keyboardType="decimal-pad" numeric autoFocus />
      <View style={styles.editRowActions}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
          <Text style={[styles.cancelButtonText, { color: c.ink50 }]}>Cancel</Text>
        </Pressable>
        <View style={styles.saveButtonWrap}>
          <SheetPrimaryButton label="Save" onPress={save} disabled={!valid} loading={saving} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    height: 16,
  },
  gapLarge: {
    height: 20,
  },
  emptyText: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    paddingVertical: 8,
  },
  groupBlock: {
    marginBottom: 18,
  },
  groupLabel: {
    fontFamily: fonts.mono600,
    fontSize: 9.5,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  accountRowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  accountName: {
    fontFamily: fonts.sans500,
    fontSize: 14.5,
  },
  accountType: {
    marginTop: 3,
  },
  accountValue: {
    fontFamily: fonts.mono600,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  addAccountRow: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
  },
  addAccountLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  cancelLink: {
    alignSelf: "center",
    marginTop: 18,
  },
  cancelLinkText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  editRow: {
    paddingTop: 13,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  editRowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 12,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  saveButtonWrap: {
    width: 120,
  },
});
