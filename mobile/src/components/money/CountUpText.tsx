import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";

import { useCountUp } from "./useCountUp";

type CountUpTextProps = {
  /** Final value to count up to. */
  target: number;
  /** Formats the in-flight (and final) numeric value for display, e.g. `formatCompact`. */
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
};

/**
 * Leaf `<Text>` wrapper around `useCountUp` (design README §Money: hero
 * net-worth "count-up value"). Owns the per-frame animated state itself so
 * only this Text re-renders on each animation tick — previously MoneyScreen
 * called `useCountUp` directly and held the in-flight value in its own
 * state, which meant the *entire* screen (every band, every row) re-rendered
 * on every requestAnimationFrame tick of the ~900ms count-up. Isolating it
 * here keeps that churn scoped to one Text node. Reduced-motion snap
 * behavior is unchanged — it lives in `useCountUp` itself.
 */
export function CountUpText({ target, format, style }: CountUpTextProps) {
  const value = useCountUp(target);
  return <Text style={style}>{format(value)}</Text>;
}
