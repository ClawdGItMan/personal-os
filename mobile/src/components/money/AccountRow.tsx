import { StyleSheet, Text, View } from "react-native";

import type { Account } from "../../data/money";
import { color, font, type } from "../../theme/tokens";
import { TriDown, TriUp } from "./icons";

type AccountRowProps = {
  account: Account;
  /** Last row drops its hairline divider. */
  last?: boolean;
};

function Delta({ account }: { account: Account }) {
  if (account.tone === "up") {
    return (
      <View style={styles.delta}>
        <TriUp size={7} color={color.green} />
        <Text style={[styles.deltaText, { color: color.green }]}>{account.delta}</Text>
      </View>
    );
  }
  if (account.tone === "muted") {
    // Down-is-muted, never red (spec §5.3) — calm neutral fg3, not an alarm.
    return (
      <View style={styles.delta}>
        <TriDown size={7} color={color.fg3} />
        <Text style={[styles.deltaText, { color: color.fg3 }]}>{account.delta}</Text>
      </View>
    );
  }
  // held / flat — dim em-dash, no triangle.
  return <Text style={[styles.deltaText, styles.held]}>{`— ${account.delta}`}</Text>;
}

/**
 * Money account list row (spec §4): name (Hanken) + class sublabel on the left,
 * mono value + delta on the right. Delta tone routes color, never red.
 */
export function AccountRow({ account, last = false }: AccountRowProps) {
  return (
    <View style={[styles.row, !last && styles.divided]}>
      <View style={styles.left}>
        <Text style={styles.name}>{account.name}</Text>
        <Text style={[type.microLabel, styles.sub]}>{account.sub}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[type.valueM, styles.value]}>{account.value}</Text>
        <Delta account={account} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
  },
  divided: {
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  left: {
    flex: 1,
  },
  name: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    letterSpacing: -0.15,
    color: color.fg1,
  },
  sub: {
    marginTop: 3,
    color: color.fg4,
  },
  right: {
    alignItems: "flex-end",
  },
  value: {
    fontSize: 15,
    lineHeight: 18,
  },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  deltaText: {
    fontFamily: font.mono,
    fontSize: 9,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
  held: {
    color: color.fg4,
    marginTop: 4,
  },
});
