import { StyleSheet, Text, View } from "react-native";

import type { TimelineItem } from "../data/home";
import { color, type } from "../theme/tokens";

const NODE = 7;

function Node({ state }: { state: TimelineItem["state"] }) {
  if (state === "done") return <View style={[styles.node, styles.nodeDone]} />;
  return <View style={[styles.node, styles.nodeUp]} />;
}

function Connector() {
  return <View style={styles.connector} />;
}

/**
 * Home TODAY timeline row (spec §4, superseded by components/spec/LedgerRow —
 * unused, kept for the migration sweep) — time → node/connector rail → title + tag.
 * done = green node + struck title · up = hollow.
 */
export function TimelineRow({ item }: { item: TimelineItem }) {
  const { state } = item;
  return (
    <View style={styles.row}>
      <Text style={[type.time, styles.timeCol]}>{item.time}</Text>
      <View style={styles.rail}>
        <Node state={state} />
        <Connector />
      </View>
      <View style={styles.content}>
        <Text style={[type.rowTitle, state === "done" && styles.titleDone, state === "up" && styles.titleUp]}>
          {item.title}
        </Text>
        <Text style={type.rowSub}>{item.tag}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timeCol: {
    width: 44,
    textAlign: "right",
  },
  rail: {
    width: NODE,
    alignItems: "center",
    alignSelf: "stretch",
    marginLeft: 9,
    marginRight: 9,
    paddingTop: 3,
    gap: 3,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 1.5,
  },
  nodeDone: {
    backgroundColor: color.green,
    borderColor: color.green,
  },
  nodeUp: {
    backgroundColor: color.bg,
    borderColor: color.fg4,
  },
  connector: {
    flex: 1,
    width: 1.5,
    backgroundColor: color.line2,
  },
  content: {
    flex: 1,
    paddingBottom: 22,
  },
  titleDone: {
    color: color.fg4,
    textDecorationLine: "line-through",
    textDecorationColor: color.line2,
  },
  titleUp: {
    color: color.fg2,
  },
});
