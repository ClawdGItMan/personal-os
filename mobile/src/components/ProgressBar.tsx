import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { color } from "../theme/tokens";

type ProgressBarProps = {
  /** 0–1 fill fraction. */
  pct: number;
  /** Solid fill color (e.g. green). Ignored when `gradient` is set. */
  fill?: string;
  /** Two-stop horizontal gradient [from, to] (e.g. green→yellow strain). */
  gradient?: [string, string];
  height?: number;
};

let gradId = 0;

/**
 * Progress bar (spec §4): surface track + fill (solid or 2-stop gradient).
 * Used by Body strain target and Focus tasks-done. Fill scales from the left.
 */
export function ProgressBar({ pct, fill = color.green, gradient, height = 8 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const id = `pbFill${gradId++}`;
  const r = height / 2;
  return (
    <View style={[styles.track, { height, borderRadius: r }]}>
      <Svg width="100%" height={height}>
        {gradient ? (
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={gradient[0]} />
              <Stop offset="1" stopColor={gradient[1]} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Rect
          x="0"
          y="0"
          width={`${clamped * 100}%`}
          height={height}
          rx={r}
          fill={gradient ? `url(#${id})` : fill}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: color.surface,
    overflow: "hidden",
  },
});
