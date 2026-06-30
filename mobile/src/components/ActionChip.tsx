import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font } from "../theme/tokens";

type IconComponent = ComponentType<{ size?: number; color: string }>;

type ActionChipProps = {
  label: string;
  /** Optional leading line-icon (e.g. ChevronIcon, PlusIcon). */
  Icon?: IconComponent;
  onPress?: () => void;
};

/** Action chip (spec §4): mono 9 uppercase, blue .4 border + blue text. Detail recs + Capture. */
export function ActionChip({ label, Icon, onPress }: ActionChipProps) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      {Icon ? (
        <View style={styles.icon}>
          <Icon size={11} color={color.blue} />
        </View>
      ) : null}
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(58,112,168,0.4)",
    borderRadius: 9,
  },
  icon: {
    marginLeft: -1,
  },
  text: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.7,
    color: color.blue,
    textTransform: "uppercase",
  },
});
