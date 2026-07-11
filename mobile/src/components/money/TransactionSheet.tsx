import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MoneyTransaction } from "../../lib/queries";
import { fireSuccessHaptic } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { fullDateTimeLabel, formatPlainSigned } from "./format";
import { FieldLabel, FormError, SegmentedToggle, SheetPrimaryButton, SheetTextField } from "./MoneyFormControls";
import { MoneySheetShell } from "./MoneySheetShell";

type Direction = "expense" | "income";

type TransactionSheetProps = {
  /** A transaction to view (read-only detail); omit/null to open in add mode. */
  transaction: MoneyTransaction | null;
  onClose: () => void;
  onAdd: (input: { name: string; amount: number; category: string }) => Promise<void>;
};

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

/**
 * Local sheet for RECENT ledger interactions (design brief §Money): tapping
 * an existing row opens a read-only detail view (no edit/delete — the data
 * layer doesn't expose transaction mutation beyond insert); the "+" in the
 * RECENT band header opens the add form. `useMoney` only stores a signed
 * `amount`, so the add form collects magnitude + an Expense/Income toggle
 * (decimal-pad has no minus key on iOS) and combines them at submit time.
 */
export function TransactionSheet({ transaction, onClose, onAdd }: TransactionSheetProps) {
  const { c, t } = useTheme();
  const [name, setName] = useState("");
  const [magnitude, setMagnitude] = useState("");
  const [category, setCategory] = useState("");
  const [direction, setDirection] = useState<Direction>("expense");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  if (transaction) {
    const amountColor = transaction.amount >= 0 ? c.accent : c.red;
    return (
      <MoneySheetShell title="TRANSACTION" onClose={onClose}>
        <Text style={[styles.detailAmount, { color: amountColor }]}>{formatPlainSigned(transaction.amount)}</Text>
        <Text style={[styles.detailName, { color: c.ink }]}>{transaction.name}</Text>
        <View style={styles.detailMetaRow}>
          <Text style={[t.bandSub, styles.detailMeta]}>{fullDateTimeLabel(transaction.occurredAt)}</Text>
          {transaction.category ? (
            <Text style={[t.bandSub, styles.detailMeta]}>{transaction.category.toUpperCase()}</Text>
          ) : null}
        </View>
      </MoneySheetShell>
    );
  }

  const parsedMagnitude = Number(magnitude);
  const valid = name.trim().length > 0 && magnitude.trim().length > 0 && Number.isFinite(parsedMagnitude) && parsedMagnitude > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setAddError(null);
    // `onAdd` (useMoney's addTransaction) THROWS on failure — caught here so
    // a failed add renders an inline error and keeps the sheet open with the
    // user's input, instead of falling through to MoneyScreen's read-error
    // retry row (that row is READ-path only; see useMoney's write contract
    // note). Close only on success.
    const amount = direction === "expense" ? -Math.abs(parsedMagnitude) : Math.abs(parsedMagnitude);
    try {
      await onAdd({ name: name.trim(), amount, category: category.trim() });
      fireSuccessHaptic();
      onClose();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MoneySheetShell title="ADD TRANSACTION" onClose={onClose}>
      <FieldLabel>NAME</FieldLabel>
      <SheetTextField value={name} onChangeText={setName} placeholder="e.g. Blue Bottle" autoFocus />

      <View style={styles.gap} />
      <FieldLabel>TYPE</FieldLabel>
      <SegmentedToggle options={DIRECTIONS} value={direction} onChange={setDirection} />

      <View style={styles.gap} />
      <FieldLabel>AMOUNT</FieldLabel>
      <SheetTextField value={magnitude} onChangeText={setMagnitude} placeholder="0.00" keyboardType="decimal-pad" numeric />

      <View style={styles.gap} />
      <FieldLabel>CATEGORY (OPTIONAL)</FieldLabel>
      <SheetTextField value={category} onChangeText={setCategory} placeholder="e.g. Dining" />

      <View style={styles.gapLarge} />
      {addError ? <FormError>{addError}</FormError> : null}
      <SheetPrimaryButton label="Add transaction" onPress={save} disabled={!valid} loading={saving} />
    </MoneySheetShell>
  );
}

const styles = StyleSheet.create({
  detailAmount: {
    fontFamily: fonts.mono600,
    fontSize: 30,
    letterSpacing: -0.9,
    fontVariant: ["tabular-nums"],
  },
  detailName: {
    fontFamily: fonts.sans600,
    fontSize: 17,
    marginTop: 10,
  },
  detailMetaRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
  },
  detailMeta: {
    letterSpacing: 0.8,
  },
  gap: {
    height: 16,
  },
  gapLarge: {
    height: 20,
  },
});
