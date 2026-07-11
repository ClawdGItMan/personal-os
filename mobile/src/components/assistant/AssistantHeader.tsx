import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { Pressed } from "../spec/Pressed";
import { IconSpark } from "../spec/iconsSpec";
import { IconClose } from "./assistantIcons";

type AssistantHeaderProps = {
  onClose: () => void;
};

/**
 * Sheet header (design README §Assistant sheet): spark 19pt + "ASSISTANT"
 * 10pt/.3em + a 30pt close circle.
 */
export function AssistantHeader({ onClose }: AssistantHeaderProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <IconSpark size={19} color={c.accent} />
        <Text style={[styles.label, { color: c.ink }]}>ASSISTANT</Text>
      </View>
      <Pressed
        accessibilityLabel="Close assistant"
        onPress={onClose}
        style={[styles.close, { borderColor: c.hairSection }]}
      >
        <IconClose size={12} color={c.ink64} />
      </Pressed>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 10,
    letterSpacing: 3,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
