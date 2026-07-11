import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { MicIcon } from "../icons";

const CORE = 74;
const FIELD = 96;

/** One concentric pulse ring — scales .6→1.5 + fades out, looping (§6.4 ambient). */
function Ring({ delay, ringColor }: { delay: number; ringColor: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 2400,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const transform = [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }];
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  return <Animated.View style={[styles.ring, { opacity, transform, borderColor: ringColor }]} />;
}

/**
 * Pulsing mic orb (spec §4 voice state): an accent core with concentric accent
 * rings rippling outward. Transform/opacity only, GPU-friendly; loops run on
 * web too (no native driver there). The single most "alive" element of the
 * Listening state alongside the waveform.
 */
export function MicOrb() {
  const { c, mode } = useTheme();
  // Accent-tint ring isn't a shared palette role — mirrors the SparkButton ring pattern.
  const ring = mode === "light" ? "rgba(30,122,82,0.4)" : "rgba(108,171,134,0.4)";
  return (
    <Animated.View style={styles.field}>
      <Ring delay={0} ringColor={ring} />
      <Ring delay={1200} ringColor={ring} />
      <Animated.View style={[styles.core, { backgroundColor: c.accent }]}>
        <MicIcon size={30} color={c.onAccent} strokeWidth={1.9} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: FIELD,
    height: FIELD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  ring: {
    position: "absolute",
    width: FIELD,
    height: FIELD,
    borderRadius: FIELD / 2,
    borderWidth: 1.5,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
