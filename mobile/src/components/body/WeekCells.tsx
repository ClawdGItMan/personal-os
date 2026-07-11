import { StyleSheet, Text, View } from "react-native";

import type { WeekDay } from "../../data/body";
import { useTheme } from "../../theme/ThemeContext";

type WeekCellsProps = {
  sessions: number;
  days: readonly WeekDay[];
};

/**
 * "THIS WEEK · N SESSIONS" grid (design README §Body): 7 cells, 22pt tall r4,
 * 8pt gaps — done/today filled accent, track cells at pipTrack. Today
 * additionally wears a ring (spec-sampled: ink at ~.28 opacity over the accent
 * fill in both modes, i.e. `c.ink28`) and its weekday label steps up to ink72;
 * other labels sit at ink38. Renders inside a `<Band variant="plain">` — no
 * border/padding of its own.
 */
export function WeekCells({ sessions, days }: WeekCellsProps) {
  const { c, t } = useTheme();
  return (
    <View>
      <View style={styles.header}>
        <Text style={t.sectionHeader}>THIS WEEK</Text>
        <Text style={t.bandSub}>{sessions} SESSIONS</Text>
      </View>
      <View style={styles.row}>
        {days.map((d, i) => {
          const filled = d.state !== "track";
          const today = d.state === "today";
          return (
            <View key={`${d.letter}-${i}`} style={styles.cellWrap}>
              <View
                style={[
                  styles.cell,
                  { backgroundColor: filled ? c.accent : c.pipTrack },
                  today && { borderWidth: 1.5, borderColor: c.ink28 },
                ]}
              />
              <Text style={[t.statSub, { color: today ? c.ink72 : c.ink38 }]}>{d.letter}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  cellWrap: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  cell: {
    width: "100%",
    height: 22,
    borderRadius: 4,
  },
});
