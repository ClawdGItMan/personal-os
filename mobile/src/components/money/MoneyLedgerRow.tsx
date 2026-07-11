import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MoneyTransaction } from "../../lib/queries";
import { layout } from "../../theme/layout";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { formatPlainSigned, ledgerDateLabel } from "./format";

type MoneyLedgerRowProps = {
  transaction: MoneyTransaction;
  onPress: () => void;
};

/**
 * RECENT transaction row (design README §Money): grid 58pt time | 1fr title |
 * auto amount — no marker dot or tag (unlike the timeline LedgerRow). The
 * amount alone carries state color (accent inflow / red outflow); older-day
 * rows read their date slot at ink34 vs a same-day clock time's ink50 (see
 * `ledgerDateLabel`). Tapping opens the TransactionSheet detail view.
 */
export function MoneyLedgerRow({ transaction, onPress }: MoneyLedgerRowProps) {
  const { c, t } = useTheme();
  const amountColor = transaction.amount >= 0 ? c.accent : c.red;
  const { label, muted } = ledgerDateLabel(transaction.occurredAt);

  return (
    <Pressable onPress={onPress} style={[styles.row, { borderTopColor: c.hairRow }]}>
      <Text style={[t.ledgerTime, styles.time, { color: muted ? c.ink34 : c.ink50 }]}>{label}</Text>
      <Text numberOfLines={1} style={[t.ledgerTitle, styles.title]}>
        {transaction.name}
      </Text>
      <Text style={[styles.amount, { color: amountColor }]}>{formatPlainSigned(transaction.amount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  time: {
    width: layout.timeCol,
  },
  title: {
    flex: 1,
  },
  amount: {
    fontFamily: fonts.mono600,
    fontSize: 12,
    letterSpacing: 0.12,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
