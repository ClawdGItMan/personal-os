import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font } from "../../theme/tokens";
import { BackChevronIcon } from "./detailIcons";

/**
 * Pushed-detail header (spec §5.5 / mockup `.dt-head`): a "‹ FOCUS" back control
 * on the left (tap → close, returns to the Focus tab) and a passive overflow
 * ••• on the right. Detail's own header — AppHeader is not used here.
 */
export function DetailHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.back} onPress={onBack} hitSlop={10}>
        <BackChevronIcon color={color.fg3} />
        <Text style={styles.backLabel}>Focus</Text>
      </Pressable>
      <View style={styles.more}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  backLabel: {
    fontFamily: font.monoBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.fg3,
    textTransform: "uppercase",
  },
  more: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: color.fg4,
  },
});
