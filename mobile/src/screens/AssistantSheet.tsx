import { useEffect, useRef } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { AlsoSeeing } from "../components/assistant/AlsoSeeing";
import { AskBar } from "../components/assistant/AskBar";
import { AssistantHeader } from "../components/assistant/AssistantHeader";
import { Briefing } from "../components/assistant/Briefing";
import { SheetFadeUp } from "../components/assistant/SheetFadeUp";
import { SuggestionChips } from "../components/assistant/SuggestionChips";
import { TopMove } from "../components/assistant/TopMove";
import type { SeeingItem } from "../data/assistant";
import { assistantData } from "../data/assistant";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { layout } from "../theme/layout";

/** Fully offscreen starting offset — comfortably below any device height. */
const SHEET_TRAVEL = 900;
/** Downward drag past this many px on release dismisses the sheet. */
const DRAG_DISMISS_PX = 100;
const SPRING = { damping: 19, stiffness: 140, mass: 0.9 };

/**
 * Assistant sheet (design README §Assistant sheet, spec 8a) — the spark
 * button's context-aware overlay: a cross-domain briefing, one ranked "top
 * move," three secondary recs, suggestion chips, and an ask bar. Slides up
 * over a scrim (translateY spring ~550ms) above the TabBar, same host
 * pattern as CaptureSheet. Every action is a stub — console.log + dismiss —
 * there's no assistant backend yet (brief B5).
 */
export function AssistantSheet() {
  const { c } = useTheme();
  const { close } = useNav();
  const translateY = useSharedValue(SHEET_TRAVEL);
  const scrim = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING);
    scrim.value = withTiming(1, { duration: 280 });
  }, [translateY, scrim]);

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

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const logAndClose = (message: string) => {
    console.log(message);
    close();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss assistant" />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: c.sheet }]}>
        <View {...pan.panHandlers} style={styles.grabberZone}>
          <View style={[styles.grabber, { backgroundColor: c.ink28 }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SheetFadeUp index={0}>
            <AssistantHeader onClose={close} />
          </SheetFadeUp>

          <SheetFadeUp index={1} style={styles.section}>
            <Briefing headline={assistantData.briefing.headline} body={assistantData.briefing.body} />
          </SheetFadeUp>

          <SheetFadeUp index={2} style={styles.bandSection}>
            <TopMove
              tag={assistantData.topMove.tag}
              title={assistantData.topMove.title}
              evidence={assistantData.topMove.evidence}
              onApply={() => logAndClose("assistant: APPLY top move — shift training to 4 PM")}
              onLater={() => logAndClose("assistant: LATER top move")}
            />
          </SheetFadeUp>

          <SheetFadeUp index={3} style={styles.section}>
            <AlsoSeeing
              items={assistantData.alsoSeeing}
              onAction={(item: SeeingItem) => logAndClose(`assistant: ${item.action} — ${item.title}`)}
            />
          </SheetFadeUp>

          <SheetFadeUp index={4} style={styles.section}>
            <SuggestionChips
              items={assistantData.suggestions}
              onSelect={(label) => console.log(`assistant: suggestion "${label}"`)}
            />
          </SheetFadeUp>

          <SheetFadeUp index={5} style={styles.section}>
            <AskBar />
          </SheetFadeUp>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "86%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  grabberZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingBottom: 34,
  },
  section: {
    marginTop: 24,
  },
  bandSection: {
    marginTop: 20,
    marginHorizontal: -layout.gutter,
  },
});
