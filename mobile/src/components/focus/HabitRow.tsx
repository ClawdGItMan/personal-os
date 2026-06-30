import { StyleSheet, Text, View } from "react-native";

import type { Habit } from "../../data/focus";
import { color, font } from "../../theme/tokens";

type HabitRowProps = {
  habit: Habit;
  /** Drop the bottom hairline (last row). */
  last?: boolean;
};

/**
 * Habit row (spec §4 / §5.4): name + streak count (green, or muted fg4 when
 * reset — never red) + 7 week-dots. Done = green, empty = line2, today = a blue
 * ring with a soft halo (may also be done, shown as a blue ring either way).
 */
export function HabitRow({ habit, last = false }: HabitRowProps) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.body}>
        <Text style={styles.name}>{habit.name}</Text>
        <Text style={[styles.streak, habit.reset && styles.streakReset]}>{habit.streak}</Text>
      </View>
      <View style={styles.week}>
        {habit.dots.map((dot, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              dot === "done" && styles.dotDone,
              dot === "today" && styles.dotToday,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  body: {
    flex: 1,
  },
  name: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    letterSpacing: -0.14,
    color: color.fg1,
  },
  streak: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: color.green,
    textTransform: "uppercase",
    marginTop: 4,
  },
  streakReset: {
    color: color.fg4,
  },
  week: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.line2,
  },
  dotDone: {
    backgroundColor: color.green,
  },
  dotToday: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: color.blue,
  },
});
