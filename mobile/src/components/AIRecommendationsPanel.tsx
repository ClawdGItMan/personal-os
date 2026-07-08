import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
import { ActionChip } from "./ActionChip";
import { SparkIcon } from "./icons";

export type Recommendation = {
  /** Rec body — pass a string, or pre-styled nodes if you need an em span. */
  text: string;
  /** Optional muted-emphasis tail appended in a dim ink (e.g. context phrase). */
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

/** Faint accent top-glow filling the bleed-to-edge panel header (spec §4). */
function TopGlow({ accent }: { accent: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="recGlow" cx="50%" cy="0%" rx="120%" ry="60%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={accent} stopOpacity={0.08} />
          <Stop offset="0.7" stopColor={accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recGlow)" />
    </Svg>
  );
}

/**
 * AI recommendations panel (spec §4 / §5.5) — the agent reaching into a detail
 * page. Bleed-to-edge block (negative horizontal margin), faint accent
 * top-glow, hairline top/bottom; header "Recommended" + accent agent dot +
 * "AI · N"; rows = spark glyph + text + ActionChip. For the agent-off state use
 * <AIRecommendationsEmpty/> (spec §6.3).
 */
export function AIRecommendationsPanel({ recommendations, count }: AIRecommendationsPanelProps) {
  const { c } = useTheme();
  const n = count ?? recommendations.length;
  return (
    <View style={[styles.panel, { borderColor: c.hairRow }]}>
      <TopGlow accent={c.accent} />
      <View style={styles.header}>
        <View style={styles.headerName}>
          <View style={[styles.agentDot, { backgroundColor: c.accent }]} />
          <Text style={[styles.headerTitle, { color: c.ink }]}>Recommended</Text>
        </View>
        <Text style={[styles.headerMeta, { color: c.accent }]}>AI · {n}</Text>
      </View>
      {recommendations.map((rec, i) => (
        <View
          key={rec.text}
          style={[styles.rec, { borderColor: c.hairRow }, i === recommendations.length - 1 && styles.recLast]}
        >
          <View style={styles.spark}>
            <SparkIcon color={c.accent} />
          </View>
          <View style={styles.recBody}>
            <Text style={[styles.recText, { color: c.ink }]}>
              {rec.text}
              {rec.emphasis ? <Text style={{ color: c.ink50 }}> {rec.emphasis}</Text> : null}
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
  const { c } = useTheme();
  return (
    <View style={[styles.panel, { borderColor: c.hairRow }]}>
      <View style={styles.header}>
        <View style={styles.headerName}>
          <View style={[styles.agentDot, { backgroundColor: c.ink38 }]} />
          <Text style={[styles.headerTitle, { color: c.ink }]}>Recommended</Text>
        </View>
        <Text style={[styles.headerMeta, { color: c.ink38 }]}>AI · OFF</Text>
      </View>
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: c.ink50 }]}>
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
  },
  headerTitle: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerMeta: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rec: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
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
    fontFamily: fonts.sans500,
    fontSize: 13,
    lineHeight: 19.5,
  },
  chipWrap: {
    marginTop: 10,
  },
  empty: {
    paddingVertical: 13,
  },
  emptyText: {
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 22,
  },
});
