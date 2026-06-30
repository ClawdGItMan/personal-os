import { StyleSheet, Text, View } from "react-native";

import type { WeekDay } from "../../data/focus";
import { color, font, radius } from "../../theme/tokens";

type WeekStripProps = {
  days: WeekDay[];
};

/**
 * Focus calendar week strip (spec §4): 7 day-cells — single-letter weekday +
 * date + a small density dot (events that day). Today reads as a blue-tinted
 * cell with a blue border; its text + dot turn blue.
 */
export function WeekStrip({ days }: WeekStripProps) {
  return (
    <View style={styles.week}>
      {days.map((day) => {
        const on = day.today === true;
        return (
          <View key={day.date} style={[styles.cell, on && styles.cellOn]}>
            <Text style={[styles.letter, on && styles.textOn]}>{day.letter}</Text>
            <Text style={[styles.date, on && styles.textOn]}>{day.date}</Text>
            <View style={[styles.dot, !day.dense && styles.dotNone, on && styles.dotOn]} />
          </View>
        );
      })}
    </View>
  );
}

const DOT = 4;

const styles = StyleSheet.create({
  week: {
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 7,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cellOn: {
    backgroundColor: "rgba(58,112,168,0.10)",
    borderColor: "rgba(58,112,168,0.45)",
  },
  letter: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1,
    color: color.fg4,
  },
  date: {
    fontFamily: font.monoSemi,
    fontSize: 15,
    color: color.fg2,
    fontVariant: ["tabular-nums"],
  },
  textOn: {
    color: color.blue,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.fg4,
  },
  dotNone: {
    backgroundColor: "transparent",
  },
  dotOn: {
    backgroundColor: color.blue,
  },
});
