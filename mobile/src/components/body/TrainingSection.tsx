import { StyleSheet, Text, View } from "react-native";

import { bodyData } from "../../data/body";
import { color, font, type } from "../../theme/tokens";
import { LiftRow } from "../LiftRow";
import { PRTag } from "../PRTag";
import { SectionHeader } from "../SectionHeader";

/**
 * Training (spec §5.2): PR count + session tag, then the day's lift rows with
 * green PR tags (shared LiftRow / PRTag, the same grammar Capture composes).
 */
export function TrainingSection() {
  const { training } = bodyData;
  const lastIndex = training.lifts.length - 1;
  return (
    <View>
      <SectionHeader title="Training" meta={training.meta} />

      <View style={styles.summary}>
        <Text style={styles.prCount}>{training.prCount}</Text>
        <Text style={[type.microLabel, styles.prLabel]}>PRs Today</Text>
        <View style={styles.spacer} />
        <PRTag label={training.sessionTag} />
      </View>

      {training.lifts.map((lift, i) => (
        <LiftRow
          key={lift.name}
          name={lift.name}
          scheme={lift.scheme}
          weight={lift.weight}
          pr={lift.pr}
          last={i === lastIndex}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  prCount: {
    fontFamily: font.monoSemi,
    fontSize: 22,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.22,
  },
  prLabel: {
    color: color.fg4,
  },
  spacer: {
    flex: 1,
  },
});
