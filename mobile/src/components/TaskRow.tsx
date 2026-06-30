import { Pressable, StyleSheet, Text, View } from "react-native";

import { useNav } from "../navigation/NavContext";
import type { DetailItem } from "../navigation/NavContext";
import { color, type } from "../theme/tokens";
import { CheckIcon, ChevronIcon } from "./icons";

type TaskRowProps = {
  title: string;
  /** Mono uppercase sublabel (e.g. "Ops · done 09:42"). */
  sub: string;
  done?: boolean;
  /** Render the sublabel in blue (time-blocked task). */
  timeBlocked?: boolean;
  /** Yellow priority flag dot. */
  priority?: boolean;
  /** Drop the bottom hairline (last row). */
  last?: boolean;
  /** Detail payload opened on tap. Defaults to a task built from title. */
  detail?: DetailItem;
};

/**
 * Task row (spec §4): checkbox (done = green + check) + title (strikethrough when
 * done) + sub (blue when time-blocked) + optional yellow flag + chevron.
 * Tappable → useNav().openDetail. Focus + Capture.
 */
export function TaskRow({ title, sub, done = false, timeBlocked = false, priority = false, last = false, detail }: TaskRowProps) {
  const { openDetail } = useNav();
  const item: DetailItem = detail ?? { kind: "task", title, sub, done };
  return (
    <Pressable style={[styles.row, last && styles.rowLast]} onPress={() => openDetail(item)}>
      <View style={[styles.checkbox, done && styles.checkboxDone]}>
        {done ? <CheckIcon color={color.bg} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={[type.rowTitle, done && styles.titleDone]}>{title}</Text>
        <Text style={[type.rowSub, styles.sub, timeBlocked && styles.blueText]}>{sub}</Text>
      </View>
      {priority ? <View style={styles.flag} /> : null}
      <ChevronIcon color={color.fg4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.line2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: color.green,
    borderColor: color.green,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 4,
  },
  blueText: {
    color: color.blue,
  },
  titleDone: {
    color: color.fg4,
    textDecorationLine: "line-through",
    textDecorationColor: color.line2,
  },
  flag: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.yellow,
  },
});
