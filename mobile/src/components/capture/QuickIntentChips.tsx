import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

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
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {intents.map((intent) => (
        <Pressable
          key={intent}
          style={[styles.chip, { borderColor: c.hairRow }]}
          onPress={() => onIntent?.(intent)}
          hitSlop={4}
        >
          <Text style={[styles.label, { color: c.ink38 }]}>{intent}</Text>
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
    borderRadius: 9,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
