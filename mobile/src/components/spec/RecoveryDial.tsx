import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../../theme/ThemeContext";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Semicircle r58 → arc length π·58 ≈ 182.2 (design README §Motion). */
const ARC_LEN = 182.2;
const ARC = "M 5 63 A 58 58 0 0 1 121 63";

type RecoveryDialProps = {
  /** Recovery score 0–100 — the arc fills score% of the semicircle. */
  score: number;
};

/**
 * Recovery dial (design README §Motion): SVG semicircle, r58, stroke 5, round
 * caps; dashoffset animates 182.2 → 182.2·(1−score/100) over 1.6s
 * cubic-bezier(.16,1,.3,1), with the score centered under the arc.
 */
export function RecoveryDial({ score }: RecoveryDialProps) {
  const { c, t } = useTheme();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(ARC_LEN);

  useEffect(() => {
    const target = ARC_LEN * (1 - score / 100);
    if (reduceMotion) {
      offset.value = target;
      return;
    }
    offset.value = withTiming(target, { duration: 1600, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [score, offset, reduceMotion]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={styles.dial}>
      <Svg width={126} height={66} viewBox="0 0 126 66">
        <Path d={ARC} stroke={c.dialTrack} strokeWidth={5} strokeLinecap="round" fill="none" />
        <AnimatedPath
          d={ARC}
          stroke={c.accent}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={ARC_LEN}
          animatedProps={arcProps}
        />
      </Svg>
      <Text style={[t.heroValue, styles.value]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dial: {
    width: 126,
    height: 66,
  },
  value: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: "center",
  },
});
