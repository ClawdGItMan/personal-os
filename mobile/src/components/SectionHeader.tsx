import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

type SectionHeaderProps = {
  title: string;
  meta?: string;
};

/** Plain-word section header (spec §1): mono uppercase + meta, no `NN //` numbers. */
export function SectionHeader({ title, meta }: SectionHeaderProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: c.ink72 }]}>{title}</Text>
      {meta ? <Text style={[styles.meta, { color: c.ink50 }]}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 26,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.mono600,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  meta: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
