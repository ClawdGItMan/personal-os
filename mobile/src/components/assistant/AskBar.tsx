import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { assistantData } from "../../data/assistant";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { IconSend } from "./assistantIcons";

/**
 * Ask bar (design README §Assistant sheet) — pill input on the elevated
 * surface with an inset ring + a 34pt accent send circle. Stub: logs the
 * question and clears (no assistant backend yet).
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
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={assistantData.askPlaceholder}
        placeholderTextColor={c.ink38}
        style={[styles.input, { color: c.ink }]}
        onSubmitEditing={send}
        returnKeyType="send"
      />
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
  input: {
    flex: 1,
    fontFamily: fonts.sans400,
    fontSize: 13,
    paddingVertical: 6,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
