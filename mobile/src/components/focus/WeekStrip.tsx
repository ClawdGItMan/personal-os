import { StyleSheet, Text, View } from "react-native";

import type { WeekCell } from "../../data/focus";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";
import { Skeleton } from "../spec/Skeleton";

type WeekStripProps = {
  days: WeekCell[];
  /** True while useFocusSessions has no data yet — renders 7 skeleton cells
   * instead of a wrong-data flash (e.g. all "—" before the real week loads). */
  loading?: boolean;
};

/**
 * Focus "THIS WEEK" strip (spec §7c): 7 ringed r8 cells — weekday letter,
 * date, and deep-work hours in accent at ~80% opacity (or "—" for a day
 * without hours). Today gets a full accent ring, an accent-tinted background
 * (reusing the LIVE band's wash token), and full-opacity accent text.
 */
export function WeekStrip({ days, loading = false }: WeekStripProps) {
  const { c } = useTheme();

  if (loading) {
    return (
      <View style={styles.row}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={[styles.cell, { borderColor: c.hairSection }]}>
            <Skeleton width={10} height={8} radius={2} />
            <Skeleton width={14} height={13} radius={2} />
            <Skeleton width={18} height={8} radius={2} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {days.map((day, i) => {
        const on = day.today === true;
        const hasHours = day.hours != null;
        return (
          <View
            key={`${day.letter}-${day.date}-${i}`}
            style={[
              styles.cell,
              { borderColor: c.hairSection },
              on && { borderColor: c.accent, backgroundColor: c.bandGrad0 },
            ]}
          >
            <Text style={[styles.letter, { color: on ? c.accent : c.ink50 }]}>{day.letter}</Text>
            <Text style={[styles.date, { color: on ? c.accent : hasHours ? c.ink : c.ink34 }]}>
              {day.date}
            </Text>
            <Text
              style={[
                styles.hours,
                hasHours ? { color: c.accent, opacity: on ? 1 : 0.8 } : { color: c.ink34 },
              ]}
            >
              {day.hours ?? "—"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: layout.radius.weekCell,
    borderWidth: 1,
  },
  letter: {
    fontFamily: fonts.mono500,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  date: {
    fontFamily: fonts.mono600,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  hours: {
    fontFamily: fonts.mono500,
    fontSize: 8,
    fontVariant: ["tabular-nums"],
  },
});
