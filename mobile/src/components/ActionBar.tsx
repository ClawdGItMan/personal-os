import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

export type ActionBarItem = {
  label: string;
  /** Mark as the primary (accent-fill) action. At most one. */
  primary?: boolean;
  onPress?: () => void;
};

/** Action bar (spec §4): row of equal pills; primary = accent fill (onAccent text), others = hairline border. Detail. */
export function ActionBar({ actions }: { actions: ActionBarItem[] }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          style={[
            styles.pill,
            action.primary ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.hairSection },
          ]}
        >
          <Text style={[styles.label, { color: action.primary ? c.onAccent : c.ink72 }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 9,
    marginTop: 22,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
});
