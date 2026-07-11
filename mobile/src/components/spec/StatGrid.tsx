import { StyleSheet, Text, View } from "react-native";

import { FadeUp } from "../../motion/FadeUp";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";

export type StatItem = {
  label: string;
  value: string;
  sub: string;
  /** State color for the value (accent/amber/red); defaults to ink. */
  valueColor?: string;
  /** State color for the sub line; defaults to ink50. */
  subColor?: string;
  /** Render pips instead of a text sub (e.g. habits n/of). */
  pips?: { n: number; of: number };
  /** Filled-pip color (state rule: habits ≤ half → amber); defaults to accent. */
  pipColor?: string;
};

type StatGridProps = {
  items: StatItem[];
  /** FadeUp stagger slot. */
  index?: number;
};

/**
 * Full-bleed 3-col stat row with column hairlines (design README §Spacing:
 * label 9 / value 20/600 / sub 8.5, columns share the row). Values default to
 * ink; pass valueColor/subColor for state-colored stats.
 */
export function StatGrid({ items, index = 0 }: StatGridProps) {
  const { c, t } = useTheme();
  return (
    <FadeUp index={index}>
      <View style={[styles.row, { borderColor: c.hairSection }]}>
        {items.map((item, i) => (
          <View
            key={item.label}
            style={[styles.cell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairCol, paddingLeft: 14 }]}
          >
            <Text style={t.statLabel}>{item.label}</Text>
            <Text style={[t.statValue, styles.value, item.valueColor != null && { color: item.valueColor }]}>
              {item.value}
            </Text>
            {item.pips ? (
              <View style={styles.pips}>
                {Array.from({ length: item.pips.of }, (_, p) => (
                  <View
                    key={p}
                    style={[styles.pip, { backgroundColor: p < (item.pips?.n ?? 0) ? (item.pipColor ?? c.accent) : c.pipTrack }]}
                  />
                ))}
              </View>
            ) : (
              <Text style={[t.statSub, styles.sub, item.subColor != null && { color: item.subColor }]}>
                {item.sub}
              </Text>
            )}
          </View>
        ))}
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
  pips: {
    flexDirection: "row",
    gap: 3,
    marginTop: 11,
  },
  pip: {
    width: 10,
    height: 3,
    borderRadius: 2,
  },
});
