import { StyleSheet, Text, View } from "react-native";

import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { BackChevronIcon } from "./detailIcons";

/**
 * Pushed-detail header (spec §5.5 / mockup `.dt-head`): a "‹ FOCUS" back control
 * on the left (tap → close, returns to the Focus tab) and a passive overflow
 * ••• on the right. Detail's own header — the shared TabBar/ScreenHeader are
 * not used here.
 */
export function DetailHeader({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Pressed style={styles.back} onPress={onBack} hitSlop={10}>
        <BackChevronIcon color={c.ink50} />
        <Text style={[styles.backLabel, { color: c.ink50 }]}>Focus</Text>
      </Pressed>
      <View style={styles.more}>
        <View style={[styles.dot, { backgroundColor: c.ink38 }]} />
        <View style={[styles.dot, { backgroundColor: c.ink38 }]} />
        <View style={[styles.dot, { backgroundColor: c.ink38 }]} />
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
    fontFamily: fonts.mono600,
    fontSize: 10,
    letterSpacing: 1.4,
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
  },
});
