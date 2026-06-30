import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font, glow } from "../theme/tokens";

export type ActionBarItem = {
  label: string;
  /** Mark as the primary (blue-fill) action. At most one. */
  primary?: boolean;
  onPress?: () => void;
};

/** Action bar (spec §4): row of equal pills; primary = blue fill (bg text), others = line2 border. Detail. */
export function ActionBar({ actions }: { actions: ActionBarItem[] }) {
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          style={[styles.pill, action.primary ? [styles.pillPrimary, glow(color.blue, 14, 0.28)] : styles.pillGhost]}
        >
          <Text style={[styles.label, action.primary ? styles.labelPrimary : styles.labelGhost]}>{action.label}</Text>
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
  pillPrimary: {
    backgroundColor: color.blue,
    borderColor: color.blue,
  },
  pillGhost: {
    borderColor: color.line2,
  },
  label: {
    fontFamily: font.monoSemi,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  labelPrimary: {
    color: color.bg,
  },
  labelGhost: {
    color: color.fg2,
  },
});
