import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

export type ActionBarItem = {
  label: string;
  /** Mark as the primary (accent-fill) action. At most one. */
  primary?: boolean;
  onPress?: () => void;
};

/** Action bar (spec §4): row of equal pills; primary = accent fill (onAccent text), others = hairline border. Detail.
 * `pending` (e.g. a write in flight) disables every pill + dims them — mirrors TopMove.tsx's pill-disabled idiom
 * so a second tap can't fire mid-write. */
export function ActionBar({ actions, pending = false }: { actions: ActionBarItem[]; pending?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          disabled={pending}
          style={[
            styles.pill,
            action.primary ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.hairSection },
            pending && styles.pillDisabled,
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
  pillDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
});
