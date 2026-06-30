import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { homeData } from "../data/home";
import { color, type } from "../theme/tokens";

type CellProps = {
  label: string;
  first?: boolean;
  children: ReactNode;
};

function Cell({ label, first = false, children }: CellProps) {
  return (
    <View style={[styles.cell, !first && styles.cellDivided]}>
      <Text style={[type.microLabel, styles.cellLabel]}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentDots({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < done && styles.dotOn]} />
      ))}
    </View>
  );
}

/** Home glance strip (spec §5.1): Recovery · Sleep · Net worth · Habits, hairline-bounded. */
export function VitalsStrip() {
  const { recovery, sleep, netWorth, habits } = homeData.vitals;
  return (
    <View style={styles.strip}>
      <Cell label="Recovery" first>
        <Text style={[type.valueM, styles.green]}>{recovery.value}</Text>
        <Text style={[type.microLabel, styles.sub]}>{recovery.sub}</Text>
      </Cell>
      <Cell label="Sleep">
        <Text style={type.valueM}>
          {sleep.hours}
          <Text style={styles.suffix}>h</Text>
          {sleep.minutes}
        </Text>
        <Text style={[type.microLabel, styles.sub]}>{sleep.sub}</Text>
      </Cell>
      <Cell label="Net Worth">
        <Text style={[type.valueM, styles.netWorth]}>
          {netWorth.value}
          <Text style={styles.suffixSm}>{netWorth.suffix}</Text>
        </Text>
        <Text style={[type.microLabel, styles.green]}>{netWorth.sub}</Text>
      </Cell>
      <Cell label="Habits">
        <Text style={type.valueM}>
          {habits.done}
          <Text style={styles.suffix}>/{habits.total}</Text>
        </Text>
        <SegmentDots done={habits.done} total={habits.total} />
      </Cell>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.line1,
    marginTop: 30,
  },
  cell: {
    flex: 1,
    paddingTop: 15,
    paddingBottom: 14,
    gap: 7,
  },
  cellDivided: {
    borderLeftWidth: 1,
    borderColor: color.line1,
    paddingLeft: 13,
  },
  cellLabel: {
    color: color.fg2,
  },
  sub: {
    color: color.fg2,
  },
  green: {
    color: color.green,
  },
  netWorth: {
    fontSize: 18,
  },
  suffix: {
    fontSize: 12,
    color: color.fg3,
  },
  suffixSm: {
    fontSize: 11,
    color: color.fg3,
  },
  dots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 9,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line2,
  },
  dotOn: {
    backgroundColor: color.green,
  },
});
