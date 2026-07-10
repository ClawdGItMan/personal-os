import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { assistantData } from "../../data/assistant";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { IconSend } from "./assistantIcons";

/**
 * Ask bar (design README §Assistant sheet) — pill input on the elevated
 * surface with an inset ring + a 34pt accent send circle. Stub: logs the
 * question and clears (no assistant backend yet).
 *
 * The placeholder is a real <Text> overlay, not the native TextInput
 * placeholder: iOS renders a custom-font placeholder with unreliable metrics
 * (observed on-device as monospace-wide, clipped text), whereas a <Text>
 * always renders in the intended Manrope. The native placeholder is left empty
 * and the overlay shows only while the field is empty.
 */
export function AskBar() {
  const { c } = useTheme();
  const [value, setValue] = useState("");

  const send = () => {
    const question = value.trim();
    if (!question) return;
    console.log("assistant: ask", question);
    setValue("");
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.hairSection }]}>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder=""
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
            {assistantData.askPlaceholder}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityLabel="Send" onPress={send} style={[styles.send, { backgroundColor: c.accent }]}>
        <IconSend size={15} color={c.onAccent} />
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
