import { StyleSheet, Text, View } from "react-native";

import { useNav } from "../../navigation/NavContext";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { Pressed } from "./Pressed";
import { SparkButton } from "./SparkButton";

/**
 * Screen header (design README §Spacing: header row at 24pt) — MAX OS wordmark
 * left, spark button (assistant trigger) right. Identical on every screen.
 * Task C3: the wordmark is now a tap target that opens Settings — same text/
 * style as before, just wrapped in `Pressed` (haptic="selection", the default
 * tap tick) instead of a bare `<Text>`.
 */
export function ScreenHeader() {
  const { t } = useTheme();
  const { openSettings } = useNav();
  return (
    <View style={styles.row}>
      <Pressed onPress={openSettings} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open settings">
        <Text style={t.wordmark}>MAX OS</Text>
      </Pressed>
      <SparkButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingTop: 12,
  },
});
