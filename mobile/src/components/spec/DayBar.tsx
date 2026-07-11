import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { useFillAnim } from "../../motion/useFillAnim";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";

type DayBarProps = {
  /** Day progress 0–100 (from the wake/sleep window). */
  pct: number;
};

/**
 * Day-progress bar (design README §Screens, home only): 2pt grey-ink track and
 * fill with an endpoint dot — no color; time is context, not state. Fill
 * animates 0→pct on mount.
 */
export function DayBar({ pct }: DayBarProps) {
  const { c } = useTheme();
  const fill = useFillAnim(pct);

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: c.dayTrack }]}>
        <Animated.View style={[styles.fill, { backgroundColor: c.dayFill }, fill]}>
          <View style={[styles.dot, { backgroundColor: c.ink }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: layout.gutter,
  },
  track: {
    height: 2,
    borderRadius: layout.radius.pill,
  },
  fill: {
    height: 2,
    borderRadius: layout.radius.pill,
  },
  dot: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
