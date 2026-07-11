import { Pressable, StyleSheet } from "react-native";

import { useNav } from "../../navigation/NavContext";
import { useTheme } from "../../theme/ThemeContext";
import { IconSpark } from "./iconsSpec";

/**
 * Assistant trigger (design README §Assistant sheet): 34×34 circle on the
 * elevated surface with an accent-tinted ring, holding the four-point spark.
 * Replaces the avatar top-right on every screen; opens the assistant overlay.
 */
export function SparkButton() {
  const { mode, c } = useTheme();
  const { openAssistant } = useNav();
  // Ring tint is spec'd per mode and isn't a shared palette role (README §Assistant).
  const ring = mode === "light" ? "rgba(30,122,82,0.35)" : "rgba(108,171,134,0.4)";

  return (
    <Pressable
      accessibilityLabel="Open assistant"
      onPress={openAssistant}
      style={[styles.button, { backgroundColor: c.surface, borderColor: ring }]}
    >
      <IconSpark size={17} color={c.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
