import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";

import { MicIcon } from "../icons";
import { color, glow } from "../../theme/tokens";

const CORE = 74;
const FIELD = 96;
// Alpha of the token blue (color.blue = rgb(58,112,168)) so the rings match the orb core.
const BLUE_RING = "rgba(58,112,168,0.4)";

/** One concentric pulse ring — scales .6→1.5 + fades out, looping (§6.4 ambient). */
function Ring({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 2400, delay, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const transform = [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }];
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  return <Animated.View style={[styles.ring, { opacity, transform }]} />;
}

/**
 * Pulsing mic orb (spec §4 voice state): a blue core with concentric blue rings
 * rippling outward. Transform/opacity only, GPU-friendly; loops run on web too
 * (no native driver there). The single most "alive" element of the Listening
 * state alongside the waveform.
 */
export function MicOrb() {
  return (
    <Animated.View style={styles.field}>
      <Ring delay={0} />
      <Ring delay={1200} />
      <Animated.View style={[styles.core, glow(color.blue, 30, 0.45)]}>
        <MicIcon size={30} color={color.bg} strokeWidth={1.9} />
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
    borderColor: BLUE_RING,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: color.blue,
    alignItems: "center",
    justifyContent: "center",
  },
});
