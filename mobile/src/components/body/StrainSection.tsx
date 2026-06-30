import { StyleSheet, Text, View } from "react-native";

import { bodyData } from "../../data/body";
import { color, font, type } from "../../theme/tokens";
import { ProgressBar } from "../ProgressBar";
import { SectionHeader } from "../SectionHeader";
import { Sparkbars } from "./Sparkbars";

/**
 * Strain (spec §5.2): yellow value + state, a green→yellow progress bar toward
 * the day target, and a 7-day sparkbar history with the peak bar in yellow.
 */
export function StrainSection() {
  const { strain } = bodyData;
  return (
    <View>
      <SectionHeader title="Strain" meta={strain.meta} />

      <View style={styles.headRow}>
        <Text style={styles.value}>{strain.value}</Text>
        <Text style={[type.microLabel, styles.state]}>{strain.state}</Text>
      </View>

      <View style={styles.progress}>
        <ProgressBar pct={strain.pct} gradient={[color.green, color.yellow]} />
      </View>

      <Sparkbars bars={strain.week} />
      <Text style={[type.microLabel, styles.caption]}>Last 7 days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  value: {
    fontFamily: font.monoSemi,
    fontSize: 34,
    lineHeight: 36,
    color: color.yellow,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.34,
  },
  state: {
    color: color.fg4,
  },
  progress: {
    marginTop: 14,
  },
  caption: {
    color: color.fg4,
    marginTop: 8,
  },
});
