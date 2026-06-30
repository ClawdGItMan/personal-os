import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";

import { color } from "../../theme/tokens";

const BARS = 15;
const HEIGHT = 40;
/** Staggered phase offsets so the bars ripple rather than pulse in unison. */
const DELAYS = [0, 100, 250, 50, 300, 150, 400, 200, 350, 80, 280, 180, 420, 120, 320];

function Bar({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 550, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(v, { toValue: 0.2, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={[styles.bar, { transform: [{ scaleY: v }] }]} />;
}

/**
 * Voice waveform (spec §4 voice state): a row of slim blue bars scaling on the
 * Y axis on staggered loops — the visual "sound" under the mic orb. ScaleY
 * (transform) only, so it stays cheap and works on react-native-web.
 */
export function Waveform() {
  return (
    <View style={styles.row}>
      {Array.from({ length: BARS }, (_, i) => (
        <Bar key={i} delay={DELAYS[i] ?? 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: HEIGHT,
    gap: 4,
    marginBottom: 22,
  },
  bar: {
    width: 3,
    height: HEIGHT,
    borderRadius: 2,
    backgroundColor: color.blue,
  },
});
