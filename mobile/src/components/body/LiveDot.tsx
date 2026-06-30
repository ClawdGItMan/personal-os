import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

import { color, glow } from "../../theme/tokens";

type LiveDotProps = {
  /** Dot color — green for Whoop, blue for Calendar (spec §4 live-data dot). */
  tone?: string;
  size?: number;
};

/**
 * Live-data dot (spec §4 / §6.4): a small dot before a source meta label that
 * shimmers on a slow ambient loop ("synced and fresh"). One of the screen's ≤3
 * allowed loops. Honors reduce-motion by holding fully opaque.
 */
export function LiveDot({ tone = color.green, size = 6 }: LiveDotProps) {
  const [pulse] = useState(() => new Animated.Value(1));
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
    if (reduceMotion === null || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
        opacity: reduceMotion ? 1 : pulse,
        ...glow(tone, 6, 0.7),
      }}
    />
  );
}
