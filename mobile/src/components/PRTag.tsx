import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

/** PR tag (spec §4): mono 8 accent on a .4-alpha accent hairline. Body + Capture. */
export function PRTag({ label = "PR" }: { label?: string }) {
  const { c, mode } = useTheme();
  const ring = mode === "light" ? "rgba(30,122,82,0.4)" : "rgba(108,171,134,0.4)";
  return (
    <View style={[styles.tag, { borderColor: ring }]}>
      <Text style={[styles.text, { color: c.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
