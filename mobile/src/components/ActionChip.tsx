import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Pressed } from "./spec/Pressed";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

type IconComponent = ComponentType<{ size?: number; color: string }>;

type ActionChipProps = {
  label: string;
  /** Optional leading line-icon (e.g. ChevronIcon, PlusIcon). */
  Icon?: IconComponent;
  onPress?: () => void;
};

/** Action chip (spec §4): mono 9 uppercase, accent-tint border + accent text. Detail recs + Capture. */
export function ActionChip({ label, Icon, onPress }: ActionChipProps) {
  const { c, mode } = useTheme();
  // Accent-tint border isn't a shared palette role — mirrors the SparkButton ring pattern.
  const ring = mode === "light" ? "rgba(30,122,82,0.4)" : "rgba(108,171,134,0.4)";
  return (
    <Pressed style={[styles.chip, { borderColor: ring }]} onPress={onPress}>
      {Icon ? (
        <View style={styles.icon}>
          <Icon size={11} color={c.accent} />
        </View>
      ) : null}
      <Text style={[styles.text, { color: c.accent }]}>{label}</Text>
    </Pressed>
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
    borderRadius: 9,
  },
  icon: {
    marginLeft: -1,
  },
  text: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
