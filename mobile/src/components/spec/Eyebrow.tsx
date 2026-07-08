import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";

type EyebrowProps = {
  /** Left mono label, e.g. "FRIDAY · MAY 8". */
  left: string;
  /** Right mono stat, e.g. "DAY 55%" (tighter tracking per README §Typography). */
  right: string;
};

/**
 * Eyebrow row (design README §Screens): mono context line + right stat, both
 * ink50. Right stat runs at .08em vs the label's .24em.
 */
export function Eyebrow({ left, right }: EyebrowProps) {
  const { t } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={t.eyebrow}>{left}</Text>
      <Text style={[t.eyebrow, styles.right]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
  },
  right: {
    letterSpacing: 0.76, // .08em × 9.5
  },
});
