import { useEffect } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../../theme/ThemeContext";

type SkeletonProps = {
  width: DimensionValue;
  height: DimensionValue;
  /** Corner radius — defaults to 4pt. */
  radius?: number;
};

const PULSE_MS = 900;
const PULSE_LOW_OPACITY = 0.5;

/**
 * Theme-aware loading placeholder block — a flat `c.ink28` fill (never an SVG
 * gradient: react-native-svg drops the alpha from rgba() gradient stops on
 * iOS, see Band.tsx) with a subtle opacity pulse between full and
 * `PULSE_LOW_OPACITY`. Used by every Wave B surface while its data hook
 * loads. Respects `useReducedMotion` — renders a static, unanimated block
 * when the OS asks for reduced motion.
 */
export function Skeleton({ width, height, radius = 4 }: SkeletonProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return; // no ambient motion when the OS asks for calm
    opacity.value = withRepeat(
      withSequence(
        withTiming(PULSE_LOW_OPACITY, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [opacity, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 : opacity.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius, backgroundColor: c.ink28 }, pulseStyle]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden",
  },
});
