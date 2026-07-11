import { StyleSheet, Text, View } from "react-native";

import type { MoneyLedgerItem } from "../../data/money";
import { layout } from "../../theme/layout";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type MoneyLedgerRowProps = {
  item: MoneyLedgerItem;
};

/**
 * RECENT transaction row (design README §Money): grid 58pt time | 1fr title |
 * auto amount — no marker dot or tag (unlike the timeline LedgerRow). The
 * amount alone carries state color (accent inflow / red outflow); "YDA" rows
 * read their time slot at ink34 vs a same-day clock time's ink50.
 */
export function MoneyLedgerRow({ item }: MoneyLedgerRowProps) {
  const { c, t } = useTheme();
  const amountColor = item.tone === "pos" ? c.accent : c.red;

  return (
    <View style={[styles.row, { borderTopColor: c.hairRow }]}>
      <Text style={[t.ledgerTime, styles.time, { color: item.muted ? c.ink34 : c.ink50 }]}>
        {item.time}
      </Text>
      <Text numberOfLines={1} style={[t.ledgerTitle, styles.title]}>
        {item.title}
      </Text>
      <Text style={[styles.amount, { color: amountColor }]}>{item.amount}</Text>
    </View>
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
