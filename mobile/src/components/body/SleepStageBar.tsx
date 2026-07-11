import { StyleSheet, Text, View } from "react-native";

import { minutesToHm } from "../../data/body";
import { useTheme } from "../../theme/ThemeContext";

type SleepStageBarProps = {
  deepMin: number;
  remMin: number;
  lightMin: number;
};

/**
 * Hex → rgba string. The sleep bar's "light" segment is accent at .28 (light) /
 * .32 (dark) opacity — not a shared palette role (design README §Body: "core
 * flex accent-tint .28 light/.32 dark"; the B3 brief renames that stage
 * LIGHT to match the live `sleep_light_min` column), so it's derived here
 * from `c.accent`.
 */
function accentTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Sleep stage bar (design README §Body): 6pt stacked bar — deep (accentDeep),
 * REM (accent), light (accent-tint) — with a mono duration legend below.
 * Segment widths are proportional to the live deep/rem/light minutes from
 * `useSleepDetail`.
 */
export function SleepStageBar({ deepMin, remMin, lightMin }: SleepStageBarProps) {
  const { mode, c, t } = useTheme();
  const lightAlpha = mode === "light" ? 0.28 : 0.32;
  const total = deepMin + remMin + lightMin;

  const stages = [
    { key: "deep", label: "DEEP", minutes: deepMin, color: c.accentDeep },
    { key: "rem", label: "REM", minutes: remMin, color: c.accent },
    { key: "light", label: "LIGHT", minutes: lightMin, color: accentTint(c.accent, lightAlpha) },
  ] as const;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {stages.map((s) => (
          <View key={s.key} style={{ flex: total > 0 ? s.minutes / total : 1, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {stages.map((s) => (
          <Text key={s.key} style={t.bandSub}>
            {s.label} {minutesToHm(s.minutes)}
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
