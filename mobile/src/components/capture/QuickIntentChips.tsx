import { StyleSheet, Text, View } from "react-native";

import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

/**
 * Quick-intent chips (spec §5.6) — deterministic capture shortcuts
 * (Workout · Expense · Task · Note). Tapping one prefills the input with the
 * matching lead-in text and focuses it (`InputDock` owns the actual prefill
 * map + focus call — this component just reports which chip was tapped).
 */
type QuickIntentChipsProps = {
  intents: readonly string[];
  onIntent?: (intent: string) => void;
  disabled?: boolean;
};

export function QuickIntentChips({ intents, onIntent, disabled = false }: QuickIntentChipsProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {intents.map((intent) => (
        <Pressed
          key={intent}
          style={[styles.chip, { borderColor: c.hairRow }, disabled && styles.chipDisabled]}
          onPress={() => onIntent?.(intent)}
          disabled={disabled}
          hitSlop={4}
        >
          <Text style={[styles.label, { color: c.ink38 }]}>{intent}</Text>
        </Pressed>
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
  chipDisabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
