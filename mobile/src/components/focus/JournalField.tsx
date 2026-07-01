import { useEffect, useRef, useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { color, font, radius, type } from "../../theme/tokens";

type JournalFieldProps = {
  /** Serif-italic prompt (e.g. "What pulled your focus today?"). */
  prompt: string;
  /** Muted "tap to write" affordance text. */
  placeholder: string;
  /**
   * Optional submit handler. When set, tapping the "write" row opens an inline
   * TextInput; submitting calls this with the text and returns whether the
   * insert succeeded (true clears + collapses the field). Omit for a static
   * "tap to write" affordance.
   */
  onSubmit?: (text: string) => Promise<boolean>;
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
export function JournalField({ prompt, placeholder, onSubmit }: JournalFieldProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  // Synchronous guard: onSubmitEditing + onBlur can both fire on native, and the
  // async `saving` state flips too late to dedupe — this blocks the second call.
  const submittingRef = useRef(false);

  const open = () => {
    if (!onSubmit) return;
    setEditing(true);
    // Focus after the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async () => {
    if (!onSubmit || submittingRef.current) return;
    if (!text.trim()) {
      setEditing(false);
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    try {
      const ok = await onSubmit(text);
      if (ok) {
        setText("");
        setEditing(false);
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.prompt}>{prompt}</Text>
      {editing ? (
        <View style={styles.write}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={color.fg4}
            multiline
            editable={!saving}
            onSubmitEditing={submit}
            onBlur={submit}
            blurOnSubmit
            returnKeyType="done"
          />
        </View>
      ) : (
        <Pressable
          style={styles.write}
          onPress={open}
          disabled={!onSubmit}
          accessibilityRole="button"
        >
          <BlinkingCaret />
          <Text style={styles.placeholder}>{placeholder}</Text>
        </Pressable>
      )}
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
  input: {
    flex: 1,
    fontFamily: font.sansSemi,
    fontSize: 13.5,
    lineHeight: 19,
    color: color.fg1,
    minHeight: 20,
    padding: 0,
  },
});
