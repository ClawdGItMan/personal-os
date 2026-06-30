import { StyleSheet, Text, View } from "react-native";

import type { TimelineItem } from "../data/home";
import { color, glow, type } from "../theme/tokens";

const NODE = 7;

function Node({ state }: { state: TimelineItem["state"] }) {
  if (state === "done") return <View style={[styles.node, styles.nodeDone]} />;
  if (state === "now") {
    return (
      <View style={styles.nowRing}>
        <View style={[styles.node, styles.nodeNow, glow(color.blue, 6, 0.5)]} />
      </View>
    );
  }
  return <View style={[styles.node, styles.nodeUp]} />;
}

function Connector({ state }: { state: TimelineItem["state"] }) {
  if (state !== "now") return <View style={styles.connector} />;
  return (
    <View style={styles.connectorNow}>
      <View style={styles.connectorNowCap} />
      <View style={styles.connector} />
    </View>
  );
}

/**
 * Home TODAY timeline row (spec §4): time → node/connector rail → title + sub.
 * done = green node + struck title · now = blue glow + pulse (motion pass) · up = hollow.
 */
export function TimelineRow({ item }: { item: TimelineItem }) {
  const { state } = item;
  return (
    <View style={styles.row}>
      <Text style={[type.time, styles.timeCol, state === "now" && styles.blue]}>{item.time}</Text>
      <View style={styles.rail}>
        <Node state={state} />
        {item.showConnector ? <Connector state={state} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={[type.rowTitle, state === "done" && styles.titleDone, state === "up" && styles.titleUp]}>
          {item.title}
        </Text>
        <Text style={[type.rowSub, state === "now" && styles.blue]}>{item.sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  blue: {
    color: color.blue,
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
  nodeNow: {
    backgroundColor: color.blue,
    borderColor: color.blue,
  },
  nodeUp: {
    backgroundColor: color.bg,
    borderColor: color.fg4,
  },
  nowRing: {
    margin: -4,
    padding: 4,
    borderRadius: (NODE + 8) / 2,
    backgroundColor: "rgba(58,112,168,0.22)",
  },
  connector: {
    flex: 1,
    width: 1.5,
    backgroundColor: color.line2,
  },
  connectorNow: {
    flex: 1,
    alignItems: "center",
  },
  connectorNowCap: {
    width: 1.5,
    height: 16,
    backgroundColor: "rgba(58,112,168,0.8)",
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
