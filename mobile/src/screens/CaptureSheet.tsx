import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import { Conversation } from "../components/capture/Conversation";
import { InputDock } from "../components/capture/InputDock";
import { SheetGlow } from "../components/capture/SheetGlow";
import { VoiceState } from "../components/capture/VoiceState";
import { CloseIcon } from "../components/icons";
import { captureData } from "../data/capture";
import { useNav } from "../navigation/NavContext";
import { color, font, radius } from "../theme/tokens";

/**
 * Capture sheet (spec §5.6) — the ⊕ agent spine. A full-screen blurred scrim
 * (tap → close) with a bottom sheet that gently rises in. The sheet holds the
 * agent conversation + input dock, and toggles into the voice Listening state
 * when the mic is tapped (Stop/Cancel/Keyboard return to the conversation).
 * Takes no props: App renders <CaptureSheet /> and it reads useNav().close.
 */
export function CaptureSheet() {
  const { close } = useNav();
  const [voice, setVoice] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(rise, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    anim.start();
    return () => anim.stop();
  }, [rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const eyebrow = voice ? captureData.header.listening : captureData.header.idle;

  return (
    <View style={styles.host}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.scrimTint]} />
      </Pressable>

      <Animated.View style={[styles.sheet, { opacity: rise, transform: [{ translateY }] }]}>
        <SheetGlow />
        <View style={styles.grabber} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.dot} />
            <Text style={styles.headerLabel}>CAPTURE</Text>
            <Text style={styles.headerAgent}>{`· ${eyebrow.toUpperCase()}`}</Text>
          </View>
          <Pressable style={styles.close} onPress={close} hitSlop={8}>
            <CloseIcon size={12} color={color.fg3} strokeWidth={2} />
          </Pressable>
        </View>

        {voice ? (
          <VoiceState
            onStop={() => setVoice(false)}
            onCancel={() => setVoice(false)}
            onKeyboard={() => setVoice(false)}
          />
        ) : (
          <>
            <Conversation />
            <InputDock onMic={() => setVoice(true)} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const SHEET_HEIGHT = Platform.OS === "web" ? 600 : "82%";

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  scrimTint: {
    backgroundColor: "rgba(8,9,12,0.55)",
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: color.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: color.line2,
    overflow: "hidden",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line2,
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: color.line1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: color.blue,
    shadowColor: color.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 0.7,
  },
  headerLabel: {
    fontFamily: font.monoBold,
    fontSize: 11,
    letterSpacing: 1.9,
    color: color.fg2,
  },
  headerAgent: {
    fontFamily: font.monoSemi,
    fontSize: 11,
    letterSpacing: 1.5,
    color: color.fg4,
    marginLeft: -3,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: color.line2,
    alignItems: "center",
    justifyContent: "center",
  },
});
