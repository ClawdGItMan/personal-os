import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../theme/ThemeContext";

const STREAK = 56;

type ShimmerProps = {
  /** Width in pt of the filled bar portion the streak sweeps across. */
  width: number;
};

/**
 * Live-progress shimmer (design README §Motion): a 56pt light streak sweeps
 * across the filled portion every 3s, 2s initial delay. Render inside an
 * overflow-hidden fill view; one pulse max per screen (the live element only).
 */
export function Shimmer({ width }: ShimmerProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return; // no ambient motion when the OS asks for calm
    progress.value = withDelay(
      2000,
      withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false),
    );
  }, [progress, reduceMotion]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-STREAK, width]) }],
  }));

  if (reduceMotion) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.streak, sweep]}>
      <Svg width={STREAK} height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.shimmer} stopOpacity={0} />
            <Stop offset="0.5" stopColor={c.shimmer} stopOpacity={1} />
            <Stop offset="1" stopColor={c.shimmer} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={STREAK} height="100%" fill="url(#shimmer)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  streak: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: STREAK,
  },
});
