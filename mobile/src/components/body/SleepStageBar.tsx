import { StyleSheet, Text, View } from "react-native";

import type { SleepStage } from "../../data/body";
import { useTheme } from "../../theme/ThemeContext";

type SleepStageBarProps = {
  stages: readonly SleepStage[];
};

/**
 * Hex → rgba string. The sleep bar's "core" segment is accent at .28 (light) /
 * .32 (dark) opacity — not a shared palette role (design README §Body: "core
 * flex accent-tint .28 light/.32 dark"), so it's derived here from `c.accent`.
 */
function accentTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Sleep stage bar (design README §Body): 6pt stacked bar — deep (accentDeep),
 * REM (accent), core (accent-tint) — with a mono duration legend below.
 */
export function SleepStageBar({ stages }: SleepStageBarProps) {
  const { mode, c, t } = useTheme();
  const coreAlpha = mode === "light" ? 0.28 : 0.32;

  const segmentColor = (key: SleepStage["key"]): string => {
    if (key === "deep") return c.accentDeep;
    if (key === "rem") return c.accent;
    return accentTint(c.accent, coreAlpha);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {stages.map((s) => (
          <View key={s.key} style={{ flex: s.fraction, backgroundColor: segmentColor(s.key) }} />
        ))}
      </View>
      <View style={styles.legend}>
        {stages.map((s) => (
          <Text key={s.key} style={t.bandSub}>
            {s.label} {s.duration}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    gap: 8,
  },
  bar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  legend: {
    flexDirection: "row",
    gap: 14,
  },
});
