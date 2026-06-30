import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import type { RangeKey } from "../../data/money";
import { color, font } from "../../theme/tokens";

type RangePillsProps = {
  ranges: RangeKey[];
  initial: RangeKey;
};

/**
 * Equal-width time-range control (spec §4 · §5.3): active = blue tint fill +
 * blue border + blue label; inactive = line border, dim label. Locally stateful
 * so taps feel live; light haptic on native (no-op on web).
 */
export function RangePills({ ranges, initial }: RangePillsProps) {
  const [active, setActive] = useState<RangeKey>(initial);

  function select(key: RangeKey) {
    setActive(key);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  }

  return (
    <View style={styles.row}>
      {ranges.map((key) => {
        const on = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => select(key)}
            style={[styles.pill, on && styles.pillOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 7,
    marginTop: 18,
  },
  pill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: color.line2,
    alignItems: "center",
  },
  pillOn: {
    borderColor: "rgba(58,112,168,0.5)",
    backgroundColor: "rgba(58,112,168,0.1)",
  },
  label: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.7,
    color: color.fg4,
  },
  labelOn: {
    color: color.blue,
  },
});
