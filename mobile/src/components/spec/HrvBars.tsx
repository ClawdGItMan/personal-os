import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ENTER_EASING } from "../../motion/FadeUp";
import { useTheme } from "../../theme/ThemeContext";

/** 7-day HRV mini-series from the locked home (design system-tokens.md). */
const DEFAULT_HEIGHTS = [14, 17, 12, 19, 16, 21, 26];

function Bar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withDelay(delay, withTiming(1, { duration: 600, easing: ENTER_EASING }));
  }, [delay, scale, reduceMotion]);

  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return <Animated.View style={[styles.bar, { height, backgroundColor: color }, grow]} />;
}

type HrvBarsProps = {
  /** Bar heights in pt; defaults to the locked 7-day series. */
  heights?: number[];
  /** Mono label above the bars, e.g. "HRV · 7D". Omit when a wrapping
   * composite (task C4's `HrvRangeBand`) already renders its own header row
   * — e.g. alongside a `RangeToggle` — so the label isn't drawn twice. */
  label?: string;
  /** Mono sub below, e.g. "64 MS · REST 48". */
  sub: string;
};

/**
 * HRV 7-day mini bars (design README §Home): w6 r2 gap3, trailing bar solid
 * accent, the rest accent-tint; bars scaleY in from the baseline, .6s with a
 * .06s stagger.
 */
export function HrvBars({ heights = DEFAULT_HEIGHTS, label, sub }: HrvBarsProps) {
  const { c, t } = useTheme();
  const last = heights.length - 1;

  return (
    <View style={styles.wrap}>
      {label != null ? <Text style={t.bandSub}>{label}</Text> : null}
      <View style={styles.bars}>
        {heights.map((h, i) => (
          <Bar key={i} height={h} color={i === last ? c.accent : c.hrvBar} delay={i * 60} />
        ))}
      </View>
      <Text style={t.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  bar: {
    width: 6,
    borderRadius: 2,
    transformOrigin: "bottom",
  },
});
