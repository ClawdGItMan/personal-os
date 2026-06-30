import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font } from "../../theme/tokens";

/**
 * Quick-intent chips (spec §5.6) — the deterministic, pre-agent capture
 * shortcuts (Workout · Expense · Task · Note). Plain mono pills; once the
 * Phase-2 agent lands these are replaced by ranked suggestion chip rows (§6.4).
 */
type QuickIntentChipsProps = {
  intents: readonly string[];
  onIntent?: (intent: string) => void;
};

export function QuickIntentChips({ intents, onIntent }: QuickIntentChipsProps) {
  return (
    <View style={styles.row}>
      {intents.map((intent) => (
        <Pressable key={intent} style={styles.chip} onPress={() => onIntent?.(intent)} hitSlop={4}>
          <Text style={styles.label}>{intent}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 11,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: color.line1,
    borderRadius: 9,
  },
  label: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.6,
    color: color.fg4,
    textTransform: "uppercase",
  },
});
