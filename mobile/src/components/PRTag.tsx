import { StyleSheet, Text, View } from "react-native";

import { color, font } from "../theme/tokens";

/** PR tag (spec §4): mono 8 green on a .4-alpha green hairline. Body + Capture. */
export function PRTag({ label = "PR" }: { label?: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderColor: "rgba(47,102,71,0.4)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: color.green,
    textTransform: "uppercase",
  },
});
