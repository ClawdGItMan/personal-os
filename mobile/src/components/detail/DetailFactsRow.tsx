import { StyleSheet, Text, View } from "react-native";

import type { Fact } from "../../data/detail";
import { color, font, type } from "../../theme/tokens";
import { AttendeeStack } from "./AttendeeStack";

/**
 * One hairline-split fact row (spec §4 "Detail facts row" / mockup `.dt-fact`):
 * mono micro-label on the left, Manrope value or an AttendeeStack on the right.
 * The parent owns the list's top hairline; each row carries its own bottom one.
 */
export function DetailFactsRow({ fact }: { fact: Fact }) {
  return (
    <View style={styles.row}>
      <Text style={type.microLabel}>{fact.label}</Text>
      {fact.attendees ? (
        <AttendeeStack attendees={fact.attendees} />
      ) : (
        <Text style={[styles.value, fact.muted && styles.valueMuted]}>{fact.value}</Text>
      )}
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
    borderColor: color.line1,
  },
  value: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.fg1,
  },
  valueMuted: {
    color: color.fg3,
  },
});
