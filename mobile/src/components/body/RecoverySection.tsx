import { StyleSheet, Text, View } from "react-native";

import { bodyData } from "../../data/body";
import { color, font, type } from "../../theme/tokens";
import { SectionHeader } from "../SectionHeader";
import { GradientRing } from "./GradientRing";
import { LiveDot } from "./LiveDot";

const RING = 138;

/**
 * Recovery (spec §5.2): gradient ring (blue→green sweep = recovery %) with a
 * centered "72% / RECOVERED", HRV / RHR / SpO₂ stat-lines beside it, a live
 * source meta, and a serif-italic read-out below.
 */
export function RecoverySection() {
  const { recovery } = bodyData;
  return (
    <View>
      <SectionHeader title="Recovery" meta={recovery.source} />
      <View style={styles.hero}>
        <GradientRing pct={recovery.pct / 100} size={RING} thickness={14} gradient={[color.blue, color.green]}>
          <Text style={styles.ringValue}>
            {recovery.pct}
            <Text style={styles.ringPct}>%</Text>
          </Text>
          <Text style={[type.microLabel, styles.ringLabel]}>Recovered</Text>
        </GradientRing>

        <View style={styles.statLines}>
          {recovery.stats.map((stat, i) => (
            <View key={stat.label} style={[styles.statRow, i === recovery.stats.length - 1 && styles.statRowLast]}>
              <Text style={type.microLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>
                {stat.value}
                <Text style={styles.statUnit}>{stat.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.readout}>
        <LiveDot size={7} />
        <Text style={[type.serifReadout, styles.readoutText]}>{recovery.readout}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 2,
  },
  ringValue: {
    fontFamily: font.monoSemi,
    fontSize: 40,
    lineHeight: 42,
    color: color.green,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
  ringPct: {
    fontSize: 15,
    color: color.fg3,
  },
  ringLabel: {
    fontSize: 7,
    marginTop: 3,
    color: color.fg3,
  },
  statLines: {
    flex: 1,
    gap: 14,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 1,
    borderColor: color.line1,
    paddingBottom: 9,
  },
  statRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  statValue: {
    fontFamily: font.monoSemi,
    fontSize: 17,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.17,
  },
  statUnit: {
    fontSize: 9,
    color: color.fg4,
  },
  readout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  readoutText: {
    flex: 1,
  },
});
