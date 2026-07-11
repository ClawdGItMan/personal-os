import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import type { PressedHaptic } from "./Pressed";
import { Pressed } from "./Pressed";

export type LedgerState = "done" | "up";

type LedgerRowProps = {
  time: string;
  title: string;
  tag: string;
  /** "done" = filled deep-accent square, struck title · "up" = outlined square, upcoming. */
  state: LedgerState;
  onPress?: () => void;
  /** Passthrough to Pressed. Defaults to "selection" (the right tick for
   * navigation/expand rows — calendar, journal). Rows whose `onPress` itself
   * performs a write (task/habit toggles) should pass "none": the owning
   * hook's `fireSuccessHaptic()` on write-completion is the feedback, so a
   * selection tick on press-in would double-fire alongside it. */
  haptic?: PressedHaptic;
};

/**
 * Timeline ledger row (design README §Spacing: grid 58pt | 1fr | auto, 12pt
 * gap, 12pt vertical padding). Done rows strike through at ink50 with times at
 * ink34; upcoming rows read at ink72 with times at ink50 — times are always
 * ink, never colored. The section header above supplies the stronger leading
 * hairline; rows carry the faint row rule.
 */
export function LedgerRow({ time, title, tag, state, onPress, haptic = "selection" }: LedgerRowProps) {
  const { c, t } = useTheme();
  const done = state === "done";

  return (
    <Pressed
      onPress={onPress}
      disabled={!onPress}
      haptic={haptic}
      style={[styles.row, { borderTopColor: c.hairRow }]}
    >
      <Text style={[t.ledgerTime, styles.time, { color: done ? c.ink34 : c.ink50 }]}>{time}</Text>
      <View style={styles.titleCell}>
        <View
          style={[
            styles.marker,
            done ? { backgroundColor: c.accentDeep } : { borderWidth: 1, borderColor: c.ink28 },
          ]}
        />
        <Text
          numberOfLines={1}
          style={[
            t.ledgerTitle,
            done
              ? { color: c.ink50, textDecorationLine: "line-through" }
              : { color: c.ink72 },
          ]}
        >
          {title}
        </Text>
      </View>
      <Text style={t.tag}>{tag}</Text>
    </Pressed>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  time: {
    width: layout.timeCol,
  },
  titleCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  marker: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
});
