import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";

import { ENTER_EASING } from "./FadeUp";

type FillAnimOpts = {
  /** Delay before the fill starts, ms (spec: ~450–500ms). */
  delay?: number;
  /** Fill duration, ms (spec: 1.1–1.3s). */
  duration?: number;
};

/**
 * Animated bar-fill width, 0% → `pct`% (design README §Motion: day %, burn,
 * session progress). 1.2s with a .45s delay by default; re-animates from the
 * current width when `pct` changes (live progress). Honors reduce-motion.
 */
export function useFillAnim(pct: number, opts?: FillAnimOpts): AnimatedStyle<ViewStyle> {
  const { delay = 450, duration = 1200 } = opts ?? {};
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      width.value = pct;
      return;
    }
    width.value = withDelay(delay, withTiming(pct, { duration, easing: ENTER_EASING }));
  }, [pct, delay, duration, width, reduceMotion]);

  return useAnimatedStyle(() => ({ width: `${width.value}%` }));
}
