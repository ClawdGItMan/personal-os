import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { SparkButton } from "./SparkButton";

/**
 * Screen header (design README §Spacing: header row at 24pt) — MAX OS wordmark
 * left, spark button (assistant trigger) right. Identical on every screen.
 */
export function ScreenHeader() {
  const { t } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={t.wordmark}>MAX OS</Text>
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
