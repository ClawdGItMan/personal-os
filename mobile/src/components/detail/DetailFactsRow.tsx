import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

export type Fact = {
  label: string;
  /** Plain value shown on the right. */
  value: string;
  /** Dim the value (mockup `.mut`) for softer, secondary facts. */
  muted?: boolean;
};

/**
 * One hairline-split fact row (spec §4 "Detail facts row" / mockup `.dt-fact`):
 * mono micro-label on the left, Manrope value on the right. The parent owns
 * the list's top hairline; each row carries its own bottom one. (The
 * attendees-stack variant is retired with task B8 — Detail no longer has
 * attendee data to render.)
 */
export function DetailFactsRow({ fact }: { fact: Fact }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderColor: c.hairRow }]}>
      <Text style={[styles.label, { color: c.ink50 }]}>{fact.label}</Text>
      <Text style={[styles.value, { color: fact.muted ? c.ink50 : c.ink }]}>{fact.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fonts.sans600,
    fontSize: 13,
  },
});
