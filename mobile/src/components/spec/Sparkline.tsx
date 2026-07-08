import { useEffect, useMemo } from "react";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Polyline } from "react-native-svg";

import { ENTER_EASING } from "../../motion/FadeUp";
import { useTheme } from "../../theme/ThemeContext";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** 30d net-worth drift — mock shape for the hero sparkline (no provider yet). */
const DEFAULT_POINTS = [3, 4, 3.6, 5, 4.6, 5.8, 5.2, 6.4, 6, 7.2, 6.8, 7.6, 8.4, 8, 9, 9.6, 9.2, 10.4, 11, 11.8];

type SparklineProps = {
  /** Raw series — normalized to fit; defaults to the mock 30d drift. */
  points?: number[];
  width: number;
  height: number;
};

/**
 * Accent sparkline (design README §Money): polyline draws in via dashoffset
 * over 1.5s, endpoint dot pops in as the line lands. Stroke 1.5, round caps.
 */
export function Sparkline({ points = DEFAULT_POINTS, width, height }: SparklineProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const dot = useSharedValue(0);

  const { path, length, endX, endY } = useMemo(() => {
    const pad = 2.5;
    const min = Math.min(...points);
    const span = Math.max(...points) - min || 1;
    const xy = points.map((v, i) => ({
      x: pad + (i / (points.length - 1)) * (width - pad * 2),
      y: height - pad - ((v - min) / span) * (height - pad * 2),
    }));
    let len = 0;
    for (let i = 1; i < xy.length; i++) len += Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y);
    const end = xy[xy.length - 1];
    return { path: xy.map((p) => `${p.x},${p.y}`).join(" "), length: len, endX: end.x, endY: end.y };
  }, [points, width, height]);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      dot.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: 1500, easing: ENTER_EASING });
    dot.value = withDelay(1300, withTiming(1, { duration: 250 }));
  }, [length, progress, dot, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  const dotProps = useAnimatedProps(() => ({ opacity: dot.value }));

  return (
    <Svg width={width} height={height}>
      <AnimatedPolyline
        points={path}
        fill="none"
        stroke={c.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={endX} cy={endY} r={2.2} fill={c.accent} animatedProps={dotProps} />
    </Svg>
  );
}
