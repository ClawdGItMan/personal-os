import { useEffect } from "react";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

/** Entrance bezier shared across the load choreography (design README §Motion). */
export const ENTER_EASING = Easing.bezier(0.22, 0.7, 0.25, 1);

/** Per-band stagger delays in seconds (design README §Motion). */
const DELAYS = [0.02, 0.07, 0.12, 0.19, 0.25, 0.31, 0.37, 0.43];

type FadeUpProps = {
  /** Stagger slot — indexes into the spec's delay ramp (clamped past 7). */
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Entrance wrapper (design README §Motion): 14pt rise + fade over 600ms,
 * cubic-bezier(.22,.7,.25,1), staggered per band by `index`. Runs once on
 * mount; honors reduce-motion by snapping to the final state.
 */
export function FadeUp({ index = 0, children, style }: FadeUpProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const delay = DELAYS[Math.min(index, DELAYS.length - 1)] * 1000;
    progress.value = withDelay(delay, withTiming(1, { duration: 600, easing: ENTER_EASING }));
  }, [index, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [14, 0]) }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
