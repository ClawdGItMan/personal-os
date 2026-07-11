import { StyleSheet, Text, View } from "react-native";

import { FadeUp } from "../../motion/FadeUp";
import { layout } from "../../theme/layout";
import { useTheme } from "../../theme/ThemeContext";
import { Pressed } from "../spec/Pressed";
import type { StatItem } from "../spec/StatGrid";

export type VitalsItem = Omit<StatItem, "pips" | "pipColor"> & {
  /** When set, the cell becomes a `Pressed` tap target (BodyScreen's WEIGHT
   * stat → inline trend expand, task C4) instead of a plain `View`. */
  onPress?: () => void;
  /** Drives `accessibilityState.expanded` on a pressable cell. */
  expanded?: boolean;
};

type VitalsGridProps = {
  items: VitalsItem[];
  /** FadeUp stagger slot. */
  index?: number;
};

/**
 * Body's vitals row (task C4) — visually identical to the shared `StatGrid`
 * (same borders/columns/type roles, design README §Spacing) but a local
 * copy, not a `StatGrid` edit: `StatGrid` is shared by Home/Focus/Money too
 * and has no per-cell press concept, and Body only needs one cell (WEIGHT)
 * to be tappable. Cells with `onPress` render as `Pressed`; the rest render
 * as plain `View`s exactly like `StatGrid`.
 */
export function VitalsGrid({ items, index = 0 }: VitalsGridProps) {
  const { c, t } = useTheme();
  return (
    <FadeUp index={index}>
      <View style={[styles.row, { borderColor: c.hairSection }]}>
        {items.map((item, i) => {
          const cellStyle = [
            styles.cell,
            i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairCol, paddingLeft: 14 },
          ];
          const content = (
            <>
              <Text style={t.statLabel}>{item.label}</Text>
              <Text style={[t.statValue, styles.value, item.valueColor != null && { color: item.valueColor }]}>
                {item.value}
              </Text>
              <Text style={[t.statSub, styles.sub, item.subColor != null && { color: item.subColor }]}>
                {item.sub}
              </Text>
            </>
          );

          if (item.onPress) {
            return (
              <Pressed
                key={item.label}
                onPress={item.onPress}
                style={cellStyle}
                accessibilityRole="button"
                accessibilityState={{ expanded: item.expanded ?? false }}
              >
                {content}
              </Pressed>
            );
          }
          return (
            <View key={item.label} style={cellStyle}>
              {content}
            </View>
          );
        })}
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: layout.bandPadV,
    paddingHorizontal: layout.gutter,
  },
  cell: {
    flex: 1,
    paddingRight: 12,
  },
  value: {
    marginTop: 9,
  },
  sub: {
    marginTop: 8,
  },
});
