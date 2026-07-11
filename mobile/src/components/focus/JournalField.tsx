import { useEffect, useRef, useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import { AccessibilityInfo, Animated, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";
import { Pressed } from "../spec/Pressed";

type JournalFieldProps = {
  /** Reflective prompt (e.g. "What pulled your focus today?"). */
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
 * Caret blink — an ambient loop (spec §Motion). RN core Animated so it runs on
 * react-native-web (Max's review surface); honors reduce-motion by holding the
 * caret solid.
 */
function BlinkingCaret({ color }: { color: string }) {
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

  return <Animated.View style={[styles.caret, { opacity, backgroundColor: color }]} />;
}

/**
 * Journal field (spec §7c QUEUE, journal-tagged row) — an inline reveal shown
 * below the queue when that row is tapped (FocusScreen owns the show/hide).
 * A bordered block with a quiet prompt, a hairline, then a "tap to write" row
 * led by a blinking accent caret — the one deliberate contained surface in
 * Focus, kept visually quiet to stay spec-adjacent.
 */
export function JournalField({ prompt, placeholder, onSubmit }: JournalFieldProps) {
  const { c } = useTheme();
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
    <View style={[styles.field, { borderColor: c.hairSection }]}>
      <Text style={[styles.prompt, { color: c.ink72 }]}>{prompt}</Text>
      {editing ? (
        <View style={[styles.write, { borderColor: c.hairSection }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: c.ink }]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={c.ink38}
            multiline
            editable={!saving}
            onSubmitEditing={submit}
            onBlur={submit}
            blurOnSubmit
            returnKeyType="done"
          />
        </View>
      ) : (
        <Pressed
          style={[styles.write, { borderColor: c.hairSection }]}
          onPress={open}
          disabled={!onSubmit}
          accessibilityRole="button"
        >
          <BlinkingCaret color={c.accent} />
          <Text style={[styles.placeholder, { color: c.ink50 }]}>{placeholder}</Text>
        </Pressed>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: layout.radius.weekCell,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
  },
  prompt: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    lineHeight: 20,
  },
  write: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  caret: {
    width: 1.5,
    height: 14,
  },
  placeholder: {
    fontFamily: fonts.sans600,
    fontSize: 12,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans500,
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 20,
    padding: 0,
  },
});
