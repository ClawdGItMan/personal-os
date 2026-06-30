import { StyleSheet, Text, View } from "react-native";

import { color, font, type } from "../theme/tokens";
import { PRTag } from "./PRTag";

type LiftRowProps = {
  /** Lift name (e.g. "Bench Press"). */
  name: string;
  /** Set scheme (e.g. "3 × 5"). */
  scheme: string;
  /** Weight value (e.g. "185"). */
  weight: string;
  /** Weight unit (e.g. "lb"). */
  unit?: string;
  /** Show a green PR tag. */
  pr?: boolean;
  /** Drop the bottom hairline (last row in a group). */
  last?: boolean;
};

/** Lift row (spec §4): name + scheme · weight (mono) + optional PR tag. Body + Capture. */
export function LiftRow({ name, scheme, weight, unit = "lb", pr = false, last = false }: LiftRowProps) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.left}>
        <Text style={type.rowTitle}>{name}</Text>
        <Text style={[type.microLabel, styles.scheme]}>{scheme}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.weight}>
          {weight}
          <Text style={styles.unit}>{unit}</Text>
        </Text>
        {pr ? <PRTag /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  left: {
    gap: 3,
  },
  scheme: {
    color: color.fg4,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weight: {
    fontFamily: font.monoSemi,
    fontSize: 16,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.16,
  },
  unit: {
    fontSize: 9,
    color: color.fg4,
  },
});
