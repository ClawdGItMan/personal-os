import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { captureData } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { MicIcon, SendIcon } from "../icons";
import { QuickIntentChips } from "./QuickIntentChips";

/**
 * Input dock (spec §5.6) — bottom of the sheet: quick-intent chips + a real
 * text field with an accent cursor, a mic button, and an accent send button.
 * The placeholder renders as a `<Text>` overlay, not the native TextInput
 * placeholder (custom-font metrics are unreliable on iOS — see the pattern
 * in `AskBar.tsx`). Voice input is iOS keyboard dictation (v1): the mic
 * button just focuses the field rather than opening a bespoke listening UI.
 * `disabled` covers every non-"ready" composer state (sending / not
 * configured / offline) — the whole dock greys out together.
 */
type InputDockProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function InputDock({ value, onChangeText, onSend, disabled = false }: InputDockProps) {
  const { c } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const applyIntent = (intent: string) => {
    const prefill = (captureData.quickIntentPrefill as Record<string, string>)[intent];
    if (prefill) onChangeText(prefill);
    inputRef.current?.focus();
  };

  const submit = () => {
    if (disabled || !value.trim()) return;
    onSend();
  };

  return (
    <View style={styles.dock}>
      <QuickIntentChips intents={captureData.quickIntents} onIntent={applyIntent} disabled={disabled} />
      <View style={[styles.field, { borderColor: c.hairSection, backgroundColor: c.surface }, disabled && styles.fieldDisabled]}>
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder=""
            editable={!disabled}
            style={[styles.input, { color: c.ink }]}
            onSubmitEditing={submit}
            returnKeyType="send"
            cursorColor={c.accent}
            selectionColor={c.accent}
          />
          {value === "" ? (
            <Text style={[styles.placeholder, { color: c.ink38 }]} numberOfLines={1} pointerEvents="none">
              {captureData.placeholder}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => inputRef.current?.focus()} hitSlop={8} style={styles.micBtn} disabled={disabled}>
          <MicIcon size={20} color={c.ink50} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          style={[styles.send, { backgroundColor: c.accent }, (disabled || !value.trim()) && styles.sendDisabled]}
          onPress={submit}
          disabled={disabled || !value.trim()}
        >
          <SendIcon size={17} color={c.onAccent} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingLeft: 16,
    paddingRight: 9,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 18,
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  inputWrap: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    paddingVertical: 0,
  },
  placeholder: {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: fonts.sans500,
    fontSize: 14,
  },
  micBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.4,
  },
});
