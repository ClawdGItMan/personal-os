import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { color } from "../../theme/tokens";

type GradientRingProps = {
  /** 0–1 sweep fraction (e.g. 0.72 = 72% recovered). */
  pct: number;
  /** Outer diameter in px. */
  size: number;
  /** Stroke thickness of the ring band. */
  thickness: number;
  /** Two-stop sweep [from, to] (blue→green for recovery / nutrition). */
  gradient: [string, string];
  /** Centered content rendered inside the bg "hole". */
  children: ReactNode;
};

let ringId = 0;

/**
 * Gradient ring (spec §4): a stroked arc that sweeps `pct` of the circle in a
 * blue→green gradient over a faint track, with a bg-colored hole hosting a
 * centered value. Used by Recovery and Nutrition. SVG arc via strokeDasharray
 * so it renders identically on react-native-web (Max's review surface).
 */
export function GradientRing({ pct, size, thickness, gradient, children }: GradientRingProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const id = `ring${ringId++}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.line2} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.hole}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hole: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
