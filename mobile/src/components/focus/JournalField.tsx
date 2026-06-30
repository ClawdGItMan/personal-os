import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";

import { color, font, radius, type } from "../../theme/tokens";

type JournalFieldProps = {
  /** Serif-italic prompt (e.g. "What pulled your focus today?"). */
  prompt: string;
  /** Muted "tap to write" affordance text. */
  placeholder: string;
};

/**
 * Caret blink — an ambient loop (spec §6.4 "carets blink"). RN core Animated so
 * it runs on react-native-web (Max's review surface); honors reduce-motion by
 * holding the caret solid.
 */
function BlinkingCaret() {
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

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
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 0, delay: 540, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 0, delay: 540, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return <Animated.View style={[styles.caret, { opacity }]} />;
}

/**
 * Journal field (spec §4 / §5.4): a bordered block (radius.field) with a
 * serif-italic prompt, a hairline, then a "tap to write" row led by a blinking
 * blue caret. The one deliberate contained surface in Focus.
 */
export function JournalField({ prompt, placeholder }: JournalFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.prompt}>{prompt}</Text>
      <View style={styles.write}>
        <BlinkingCaret />
        <Text style={styles.placeholder}>{placeholder}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: color.line1,
    borderRadius: radius.field,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 15,
  },
  prompt: {
    ...type.serifReadout,
    fontFamily: font.serifItalic,
    fontSize: 18,
    lineHeight: 23,
    color: color.fg2,
  },
  write: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderColor: color.line1,
  },
  caret: {
    width: 1.5,
    height: 14,
    backgroundColor: color.blue,
  },
  placeholder: {
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.fg4,
  },
});
