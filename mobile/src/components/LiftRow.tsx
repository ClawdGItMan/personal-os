import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
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
  /** Show an accent PR tag. */
  pr?: boolean;
  /** Drop the bottom hairline (last row in a group). */
  last?: boolean;
};

/** Lift row (spec §4): name + scheme · weight (mono) + optional PR tag. Body + Capture. */
export function LiftRow({ name, scheme, weight, unit = "lb", pr = false, last = false }: LiftRowProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderColor: c.hairRow }, last && styles.rowLast]}>
      <View style={styles.left}>
        <Text style={[styles.name, { color: c.ink }]}>{name}</Text>
        <Text style={[styles.scheme, { color: c.ink38 }]}>{scheme}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.weight, { color: c.ink }]}>
          {weight}
          <Text style={[styles.unit, { color: c.ink38 }]}>{unit}</Text>
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
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  left: {
    gap: 3,
  },
  name: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    letterSpacing: -0.15,
  },
  scheme: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 3,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weight: {
    fontFamily: fonts.mono500,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  unit: {
    fontSize: 9,
  },
});
