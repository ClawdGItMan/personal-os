import { StyleSheet, View } from "react-native";

import { color } from "../../theme/tokens";

type Bar = { height: number; peak?: boolean };

type SparkbarsProps = {
  /** Relative bar heights 0–1; `peak` bars render in yellow. */
  bars: readonly Bar[];
  height?: number;
};

/**
 * Sparkbars (spec §4): a row of flex bars rising from the baseline; the peak /
 * latest bar is yellow, the rest neutral. Used by Body strain's 7-day history.
 * Plain Views (origin-bottom heights) render identically on react-native-web.
 */
export function Sparkbars({ bars, height = 40 }: SparkbarsProps) {
  return (
    <View style={[styles.row, { height }]}>
      {bars.map((bar, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: `${Math.max(0, Math.min(1, bar.height)) * 100}%` },
            bar.peak ? styles.peak : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    marginTop: 16,
  },
  bar: {
    flex: 1,
    backgroundColor: color.line2,
    borderRadius: 2,
  },
  peak: {
    backgroundColor: color.yellow,
  },
});
