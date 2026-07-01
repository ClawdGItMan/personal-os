import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Habit } from "../../data/focus";
import { color, font } from "../../theme/tokens";

type HabitRowProps = {
  habit: Habit;
  /** Drop the bottom hairline (last row). */
  last?: boolean;
  /** Whether today's log is currently done — drives what tapping the ring sets. */
  todayDone?: boolean;
  /**
   * Optional handler for tapping today's dot (the last, "today" ring). When set,
   * that dot becomes a tap target that toggles today's log to `next`.
   */
  onToggleToday?: (next: boolean) => void;
};

/**
 * Habit row (spec §4 / §5.4): name + streak count (green, or muted fg4 when
 * reset — never red) + 7 week-dots. Done = green, empty = line2, today = a blue
 * ring with a soft halo (may also be done, shown as a blue ring either way).
 */
export function HabitRow({ habit, last = false, todayDone = false, onToggleToday }: HabitRowProps) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.body}>
        <Text style={styles.name}>{habit.name}</Text>
        <Text style={[styles.streak, habit.reset && styles.streakReset]}>{habit.streak}</Text>
      </View>
      <View style={styles.week}>
        {habit.dots.map((dot, i) => {
          if (dot === "today") {
            // Today's ring: green fill when done, blue ring always. Tappable when
            // a handler is supplied so it toggles today's log.
            const inner = (
              <View style={[styles.dot, styles.dotToday, todayDone && styles.dotTodayDone]} />
            );
            return onToggleToday ? (
              <Pressable
                key={i}
                onPress={() => onToggleToday(!todayDone)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: todayDone }}
              >
                {inner}
              </Pressable>
            ) : (
              <View key={i}>{inner}</View>
            );
          }
          return <View key={i} style={[styles.dot, dot === "done" && styles.dotDone]} />;
        })}
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
  dotTodayDone: {
    backgroundColor: color.green,
  },
});
