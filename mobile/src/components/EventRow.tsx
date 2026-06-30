import { Pressable, StyleSheet, Text, View } from "react-native";

import { useNav } from "../navigation/NavContext";
import type { DetailItem } from "../navigation/NavContext";
import { color, glow, type } from "../theme/tokens";
import { ChevronIcon } from "./icons";

export type EventState = "done" | "now" | "up";

type EventRowProps = {
  /** Left-aligned time (mono), or "NOW". */
  time: string;
  state?: EventState;
  title: string;
  /** Mono uppercase sublabel (e.g. "Calendar · Cipriani"). */
  sub: string;
  /** Drop the bottom hairline (last row). */
  last?: boolean;
  /** Detail payload opened on tap. Defaults to an event built from title. */
  detail?: DetailItem;
};

/**
 * Event row (spec §4): time + status dot (done green / now blue-glow / up hollow)
 * + title + sub + chevron. Tappable → useNav().openDetail. Focus + Capture.
 */
export function EventRow({ time, state = "up", title, sub, last = false, detail }: EventRowProps) {
  const { openDetail } = useNav();
  const item: DetailItem = detail ?? { kind: "event", title, time, sub, state };
  return (
    <Pressable style={[styles.row, last && styles.rowLast]} onPress={() => openDetail(item)}>
      <Text style={[styles.time, state === "now" && styles.blueText]}>{time}</Text>
      <Dot state={state} />
      <View style={styles.body}>
        <Text style={[type.rowTitle, state === "done" && styles.titleDone]}>{title}</Text>
        <Text style={[type.rowSub, styles.sub, state === "now" && styles.blueText]}>{sub}</Text>
      </View>
      <ChevronIcon color={color.fg4} />
    </Pressable>
  );
}

function Dot({ state }: { state: EventState }) {
  if (state === "done") return <View style={[styles.dot, styles.dotDone]} />;
  if (state === "now") return <View style={[styles.dot, styles.dotNow, glow(color.blue, 6, 0.5)]} />;
  return <View style={styles.dot} />;
}

const DOT = 9;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  time: {
    ...type.time,
    width: 42,
    textAlign: "right",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderColor: color.fg4,
    backgroundColor: color.bg,
  },
  dotDone: {
    backgroundColor: color.green,
    borderColor: color.green,
  },
  dotNow: {
    backgroundColor: color.blue,
    borderColor: color.blue,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 3,
  },
  blueText: {
    color: color.blue,
  },
  titleDone: {
    color: color.fg3,
  },
});
