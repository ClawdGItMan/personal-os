import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SeeingItem } from "../../data/assistant";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type SeeingRowProps = {
  item: SeeingItem;
  first: boolean;
  onAction: () => void;
};

/**
 * ALSO SEEING row (design README §Assistant sheet) — a 52pt tag | 1fr | pill
 * grid. components/spec/LedgerRow is a 58pt-time | 1fr | auto grid built for
 * timeline rows (marker dot + strike-through), which doesn't fit a domain tag
 * + action pill, so this is its own row (foundation note, brief B5).
 */
export function SeeingRow({ item, first, onAction }: SeeingRowProps) {
  const { c, t } = useTheme();
  const accentAction = item.actionTone === "accent";

  return (
    <View style={[styles.row, { borderTopColor: first ? c.hairSection : c.hairRow }]}>
      <Text style={[styles.tag, { color: c.ink50 }]}>{item.tag}</Text>
      <View style={styles.body}>
        <Text style={t.ledgerTitle}>{item.title}</Text>
        <Text style={[t.bandSub, styles.sub]}>{item.sub}</Text>
      </View>
      <Pressable onPress={onAction} style={[styles.pill, { borderColor: accentAction ? c.accent : c.hairSection }]}>
        <Text style={[styles.pillLabel, { color: accentAction ? c.accent : c.ink64 }]}>{item.action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  tag: {
    width: 52,
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 4,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  pillLabel: {
    fontFamily: fonts.mono600,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
