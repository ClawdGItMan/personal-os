import { useEffect, useRef } from "react";
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { Conversation } from "../components/capture/Conversation";
import { InputDock } from "../components/capture/InputDock";
import { SheetGlow } from "../components/capture/SheetGlow";
import { useCaptureSession } from "../components/capture/useCaptureSession";
import { CloseIcon } from "../components/icons";
import { Pressed } from "../components/spec/Pressed";
import { captureData } from "../data/capture";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

/** Resting-offset the sheet rises in from (design's short rise + fade — not a
 * full off-screen throw like AssistantSheet's slide-up). */
const RISE_FROM = 40;
/** Downward drag past this many px on release dismisses the sheet — matches
 * AssistantSheet's grabberZone threshold. */
const DRAG_DISMISS_PX = 100;
const SPRING = { damping: 19, stiffness: 140, mass: 0.9 };

/**
 * Capture sheet (spec §5.6) — the ⊕ agent spine. A full-screen blurred scrim
 * (tap → close) with a bottom sheet that gently rises in, holding the live
 * agent conversation (`useCaptureSession`, task B7) + input dock. Voice input
 * is iOS keyboard dictation (v1): the mic just focuses the text field, so
 * there's no separate listening screen to swap in anymore. Retheme onto
 * ivy/porcelain: same flow, blur tint follows the active mode so the scrim
 * reads correctly in both. Takes no props: App renders <CaptureSheet /> and
 * it reads useNav().close.
 *
 * Task C1: the grabber gained the same PanResponder drag-dismiss as
 * AssistantSheet's grabberZone (same DRAG_DISMISS_PX/SPRING) — previously
 * this sheet was scrim-tap-only. The entrance rise/fade moved from RN core
 * Animated to Reanimated so the same `translateY` shared value drives both
 * the mount entrance and the live drag offset.
 */
export function CaptureSheet() {
  const { c, mode } = useTheme();
  const { close } = useNav();
  const capture = useCaptureSession();
  const translateY = useSharedValue(RISE_FROM);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [translateY, opacity]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.value = g.dy;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_DISMISS_PX) close();
        else translateY.value = withSpring(0, SPRING);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const eyebrow = capture.composerState === "sending" ? captureData.header.sending : captureData.header.idle;

  return (
    <View style={styles.host}>
      {/* Full-bleed dismiss scrim — no visible surface to give press physics
          to, and a haptic tick on "tap outside to close" would read as
          noise, so this stays a plain Pressable. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <BlurView intensity={10} tint={mode === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
      </Pressable>

      <Animated.View style={[styles.sheet, { backgroundColor: c.sheet, borderColor: c.hairSection }, sheetStyle]}>
        <SheetGlow />
        <View {...pan.panHandlers} style={styles.grabberZone}>
          <View style={[styles.grabber, { backgroundColor: c.hairSection }]} />
        </View>

        <View style={[styles.header, { borderColor: c.hairRow }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: c.accent }]} />
            <Text style={[styles.headerLabel, { color: c.ink72 }]}>CAPTURE</Text>
            <Text style={[styles.headerAgent, { color: c.ink38 }]}>{`· ${eyebrow.toUpperCase()}`}</Text>
          </View>
          <Pressed style={[styles.close, { borderColor: c.hairSection }]} onPress={close} hitSlop={8}>
            <CloseIcon size={12} color={c.ink50} strokeWidth={2} />
          </Pressed>
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <Conversation entries={capture.entries} onUndo={capture.undo} onRetry={capture.retry} />
          <InputDock
            value={capture.input}
            onChangeText={capture.setInput}
            onSend={() => capture.send(capture.input)}
            disabled={capture.composerState !== "ready"}
          />
        </KeyboardAvoidingView>
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
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  body: {
    flex: 1,
  },
  grabberZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
  },
  headerLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 1.9,
  },
  headerAgent: {
    fontFamily: fonts.mono500,
    fontSize: 11,
    letterSpacing: 1.5,
    marginLeft: -3,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
