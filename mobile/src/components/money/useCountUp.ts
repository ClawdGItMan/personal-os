import { useEffect, useRef, useState } from "react";
import { Easing } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const DURATION_MS = 900;

/**
 * Counts a numeric value up from its previously rendered value to `target`
 * (design README §Money: hero net-worth "count-up value"). Driven by
 * `requestAnimationFrame` on the JS thread (not a reanimated worklet) since
 * the consumer re-formats the in-flight number through `formatCompact` every
 * frame, which isn't worklet-safe. Snaps instantly to `target` when the OS
 * requests reduced motion.
 */
export function useCountUp(target: number): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = Date.now();
    const ease = Easing.out(Easing.cubic);

    function tick() {
      const p = Math.min(1, (Date.now() - start) / DURATION_MS);
      setValue(from + (target - from) * ease(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reduceMotion]);

  return value;
}
