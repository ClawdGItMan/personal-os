import { StyleSheet, Text, View } from "react-native";

import { bodyData, type SleepStage } from "../../data/body";
import { color, font, type } from "../../theme/tokens";
import { SectionHeader } from "../SectionHeader";

/** Token color for each sleep stage tone (light/awake are neutral fades). */
const STAGE_TONE: Record<SleepStage["tone"], string> = {
  green: color.green,
  blue: color.blue,
  light: "rgba(242,238,230,0.16)",
  awake: "rgba(242,238,230,0.30)",
};

/**
 * Sleep (spec §5.2): big duration + quality%, a horizontal stacked stage bar
 * (deep / REM / light / awake) and a 4-up legend underneath.
 */
export function SleepSection() {
  const { sleep } = bodyData;
  return (
    <View>
      <SectionHeader title="Sleep" meta={sleep.meta} />

      <View style={styles.headRow}>
        <Text style={styles.duration}>
          {sleep.hours}
          <Text style={styles.durationUnit}>h</Text>
          {sleep.minutes}
        </Text>
        <View style={styles.qualityCol}>
          <Text style={[type.microLabel, styles.qualityLabel]}>Quality</Text>
          <Text style={styles.qualityValue}>{sleep.quality}</Text>
        </View>
      </View>

      <View style={styles.bar}>
        {sleep.stages.map((stage) => (
          <View
            key={stage.label}
            style={{ flex: stage.fraction, backgroundColor: STAGE_TONE[stage.tone] }}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {sleep.stages.map((stage) => (
          <View key={stage.label} style={styles.legendCell}>
            <Text style={[type.microLabel, styles.legendLabel]}>{stage.label}</Text>
            <Text style={styles.legendValue}>{stage.duration}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  duration: {
    fontFamily: font.monoSemi,
    fontSize: 34,
    lineHeight: 36,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.34,
  },
  durationUnit: {
    fontSize: 18,
    color: color.fg3,
  },
  qualityCol: {
    alignItems: "flex-end",
  },
  qualityLabel: {
    color: color.fg4,
  },
  qualityValue: {
    fontFamily: font.monoSemi,
    fontSize: 20,
    color: color.green,
    fontVariant: ["tabular-nums"],
    marginTop: 5,
  },
  bar: {
    flexDirection: "row",
    height: 16,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 14,
    backgroundColor: color.surface,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  legendCell: {
    alignItems: "center",
  },
  legendLabel: {
    fontSize: 7,
    color: color.fg4,
  },
  legendValue: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.fg2,
    fontVariant: ["tabular-nums"],
    marginTop: 3,
  },
});
