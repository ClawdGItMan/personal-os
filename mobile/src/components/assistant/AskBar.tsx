import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { assistantConfig } from "../../data/assistant";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { IconSend, IconStop } from "./assistantIcons";

type AskBarProps = {
  /** Submit a trimmed, non-empty question — the caller owns what happens next
   * (brief B6: first send switches the sheet into chat mode). */
  onSend: (text: string) => void;
  /** True while a reply is streaming — dims the field and swaps the send
   * circle to a stop glyph (tap to cancel the in-flight `streamChat`). */
  sending?: boolean;
  onStop?: () => void;
};

/**
 * Ask bar (design README §Assistant sheet) — pill input on the elevated
 * surface with an inset ring + a 34pt accent send circle.
 *
 * The placeholder is a real <Text> overlay, not the native TextInput
 * placeholder: iOS renders a custom-font placeholder with unreliable metrics
 * (observed on-device as monospace-wide, clipped text), whereas a <Text>
 * always renders in the intended Manrope. The native placeholder is left empty
 * and the overlay shows only while the field is empty. (This overlay
 * mechanism is load-bearing — left untouched by brief B6.)
 */
export function AskBar({ onSend, sending = false, onStop }: AskBarProps) {
  const { c } = useTheme();
  const [value, setValue] = useState("");

  const send = () => {
    if (sending) return;
    const question = value.trim();
    if (!question) return;
    onSend(question);
    setValue("");
  };

  const handlePressCircle = () => {
    if (sending) onStop?.();
    else send();
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.hairSection }, sending && styles.barSending]}>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder=""
          editable={!sending}
          style={[styles.input, { color: c.ink }]}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        {value === "" ? (
          <Text
            style={[styles.placeholder, { color: c.ink38 }]}
            numberOfLines={1}
            pointerEvents="none"
          >
            {assistantConfig.askPlaceholder}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={sending ? "Stop" : "Send"}
        onPress={handlePressCircle}
        style={[styles.send, { backgroundColor: c.accent }]}
      >
        {sending ? <IconStop size={13} color={c.onAccent} /> : <IconSend size={15} color={c.onAccent} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
    gap: 10,
  },
  barSending: {
    opacity: 0.85,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    paddingVertical: 6,
  },
  placeholder: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingVertical: 6,
    fontFamily: fonts.sans400,
    fontSize: 13,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
