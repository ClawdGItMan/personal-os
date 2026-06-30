import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";

type SectionEnterProps = {
  children: ReactNode;
  /** Stagger order — each step adds 60ms before this section rises in. */
  index?: number;
};

const RISE = 10;
const DURATION = 500;
const STAGGER = 60;

/**
 * One-time entrance wrapper (spec §6.4 "Fable pass"): sections rise translateY
 * 10→0 + fade 0→1 over ~0.5s, staggered by `index`. Uses RN core Animated (not
 * Reanimated entering layout animations — those are unreliable on web, which is
 * Max's review surface). Honors reduce-motion: skips straight to the final state.
 */
export function SectionEnter({ children, index = 0 }: SectionEnterProps) {
  // Lazy state init creates the driver + its interpolation exactly once, and as
  // state (not a ref) it's safe to read during render.
  const [{ progress, translateY }] = useState(() => {
    const value = new Animated.Value(0);
    return {
      progress: value,
      translateY: value.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }),
    };
  });
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      delay: index * STAGGER,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index, reduceMotion]);

  // Hold layout invisible until we know the motion preference, to avoid a flash.
  if (reduceMotion === null) return <Animated.View style={styles.hidden}>{children}</Animated.View>;

  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
});
