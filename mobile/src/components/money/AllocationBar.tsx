import { StyleSheet, Text, View } from "react-native";

import type { AllocationClass } from "../../data/money";
import { color, font, type } from "../../theme/tokens";

type AllocationBarProps = {
  classes: AllocationClass[];
};

/**
 * Allocation stacked bar + legend (spec §4 · §5.3): one rounded bar split into
 * class-colored segments, then a legend row per class — swatch + name (Hanken)
 * on the left, mono "$X · NN%" read-out on the right.
 */
export function AllocationBar({ classes }: AllocationBarProps) {
  return (
    <View>
      <View style={styles.bar}>
        {classes.map((c, i) => (
          <View
            key={c.name}
            style={{ flex: c.fraction, backgroundColor: c.swatch, marginLeft: i === 0 ? 0 : 1 }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {classes.map((c) => (
          <View key={c.name} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.swatch, { backgroundColor: c.swatch }]} />
              <Text style={styles.legendName}>{c.name}</Text>
            </View>
            <Text style={[type.sectionMeta, styles.legendValue]}>{c.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    marginTop: 6,
    backgroundColor: color.surface,
  },
  legend: {
    marginTop: 16,
    gap: 11,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendName: {
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.fg1,
  },
  legendValue: {
    color: color.fg2,
    textTransform: "none",
    letterSpacing: -0.1,
  },
});
