import { useEffect } from "react";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ENTER_EASING } from "../../motion/FadeUp";

/**
 * The assistant sheet's own stagger ramp (design README §Assistant sheet:
 * ".05/.12/.19/.26/.33/.4s"), which doesn't line up with FadeUp's home-screen
 * ramp (motion/FadeUp.tsx DELAYS). Mirrors FadeUp's 14pt rise + 600ms fade —
 * same easing, imported read-only — just keyed by an explicit slot index into
 * this sheet-specific ramp instead of the shared one.
 */
const SHEET_DELAYS = [0.05, 0.12, 0.19, 0.26, 0.33, 0.4];

type SheetFadeUpProps = {
  /** Stagger slot — indexes into the sheet's own delay ramp (clamped past 5). */
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SheetFadeUp({ index, children, style }: SheetFadeUpProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const delay = SHEET_DELAYS[Math.min(index, SHEET_DELAYS.length - 1)] * 1000;
    progress.value = withDelay(delay, withTiming(1, { duration: 600, easing: ENTER_EASING }));
  }, [index, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [14, 0]) }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
