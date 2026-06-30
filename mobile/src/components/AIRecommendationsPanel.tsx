import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { color, font, type } from "../theme/tokens";
import { ActionChip } from "./ActionChip";
import { SparkIcon } from "./icons";

/** Panel glow reads from the token palette so it tracks the Max-tuned blue. */
const BLUE = color.blue;

export type Recommendation = {
  /** Rec body — pass a string, or pre-styled nodes if you need an em span. */
  text: string;
  /** Optional muted-emphasis tail appended in fg3 (e.g. context phrase). */
  emphasis?: string;
  /** Action chip label (e.g. "Open draft"). Omit for a text-only rec. */
  action?: string;
  onAction?: () => void;
};

type AIRecommendationsPanelProps = {
  recommendations: Recommendation[];
  /** Count shown in the "AI · N" meta. Defaults to recommendations.length. */
  count?: number;
};

/** Faint blue top-glow filling the bleed-to-edge panel header (spec §4). */
function TopGlow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="recGlow" cx="50%" cy="0%" rx="120%" ry="60%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={BLUE} stopOpacity={0.08} />
          <Stop offset="0.7" stopColor={BLUE} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recGlow)" />
    </Svg>
  );
}

/**
 * AI recommendations panel (spec §4 / §5.5) — the agent reaching into a detail
 * page. Bleed-to-edge block (negative horizontal margin), faint blue top-glow,
 * hairline top/bottom; header "Recommended" + blue agent dot + "AI · N"; rows =
 * spark glyph + text + ActionChip. For the agent-off state use
 * <AIRecommendationsEmpty/> (spec §6.3).
 */
export function AIRecommendationsPanel({ recommendations, count }: AIRecommendationsPanelProps) {
  const n = count ?? recommendations.length;
  return (
    <View style={styles.panel}>
      <TopGlow />
      <View style={styles.header}>
        <View style={styles.headerName}>
          <View style={styles.agentDot} />
          <Text style={styles.headerTitle}>Recommended</Text>
        </View>
        <Text style={styles.headerMeta}>AI · {n}</Text>
      </View>
      {recommendations.map((rec, i) => (
        <View key={rec.text} style={[styles.rec, i === recommendations.length - 1 && styles.recLast]}>
          <View style={styles.spark}>
            <SparkIcon color={color.blue} />
          </View>
          <View style={styles.recBody}>
            <Text style={styles.recText}>
              {rec.text}
              {rec.emphasis ? <Text style={styles.recEm}> {rec.emphasis}</Text> : null}
            </Text>
            {rec.action ? (
              <View style={styles.chipWrap}>
                <ActionChip label={rec.action} onPress={rec.onAction} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Agent-off empty state (spec §6.3) — shown until the Phase-2 agent is live. */
export function AIRecommendationsEmpty() {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerName}>
          <View style={[styles.agentDot, styles.agentDotOff]} />
          <Text style={styles.headerTitle}>Recommended</Text>
        </View>
        <Text style={styles.headerMetaOff}>AI · OFF</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          The agent isn&apos;t connected yet. Recommendations will appear here once it&apos;s on.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: -22,
    marginTop: 26,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.line1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  headerName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: color.blue,
    shadowColor: color.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0.7,
  },
  agentDotOff: {
    backgroundColor: color.fg4,
    shadowOpacity: 0,
  },
  headerTitle: {
    fontFamily: font.monoBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: color.fg1,
    textTransform: "uppercase",
  },
  headerMeta: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.8,
    color: color.blue,
    textTransform: "uppercase",
  },
  headerMetaOff: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.8,
    color: color.fg4,
    textTransform: "uppercase",
  },
  rec: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  recLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  spark: {
    marginTop: 1,
  },
  recBody: {
    flex: 1,
  },
  recText: {
    fontFamily: font.sans,
    fontSize: 13,
    lineHeight: 19.5,
    color: color.fg1,
  },
  recEm: {
    color: color.fg3,
  },
  chipWrap: {
    marginTop: 10,
  },
  empty: {
    paddingVertical: 13,
  },
  emptyText: {
    ...type.serifReadout,
    color: color.fg3,
  },
});
