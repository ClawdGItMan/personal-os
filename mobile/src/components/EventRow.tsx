import { StyleSheet, Text, View } from "react-native";

import { useNav } from "../navigation/NavContext";
import type { DetailItem } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
import { ChevronIcon } from "./icons";
import { Pressed } from "./spec/Pressed";

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
 * Event row (spec §4): time + status dot (done accent / now accent-glow / up
 * hollow) + title + sub + chevron. Tappable → useNav().openDetail. Kept for its
 * exported `EventState` type — consumed by `useCalendarToday` — the row itself
 * is superseded by `components/spec/LedgerRow` on the live screens.
 */
export function EventRow({ time, state = "up", title, sub, last = false, detail }: EventRowProps) {
  const { c } = useTheme();
  const { openDetail } = useNav();
  const item: DetailItem = detail ?? { kind: "event", title, time, sub, state };
  const dotActive = state === "done" || state === "now";
  return (
    <Pressed style={[styles.row, { borderColor: c.hairRow }, last && styles.rowLast]} onPress={() => openDetail(item)}>
      <Text style={[styles.time, { color: state === "now" ? c.accent : c.ink50 }]}>{time}</Text>
      <View
        style={[
          styles.dot,
          { borderColor: dotActive ? c.accent : c.ink38, backgroundColor: dotActive ? c.accent : c.bg },
        ]}
      />
      <View style={styles.body}>
        <Text style={[styles.title, { color: state === "done" ? c.ink50 : c.ink }]}>{title}</Text>
        <Text style={[styles.sub, { color: state === "now" ? c.accent : c.ink38 }]}>{sub}</Text>
      </View>
      <ChevronIcon color={c.ink38} />
    </Pressed>
  );
}

const DOT = 9;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  time: {
    fontFamily: fonts.mono500,
    fontSize: 10,
    width: 42,
    textAlign: "right",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    letterSpacing: -0.15,
  },
  sub: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 3,
  },
});
