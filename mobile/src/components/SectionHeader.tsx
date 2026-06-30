import { StyleSheet, Text, View } from "react-native";

import { type } from "../theme/tokens";

type SectionHeaderProps = {
  title: string;
  meta?: string;
};

/** Plain-word section header (spec §1): mono uppercase + meta, no `NN //` numbers. */
export function SectionHeader({ title, meta }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={type.sectionTitle}>{title}</Text>
      {meta ? <Text style={type.sectionMeta}>{meta}</Text> : null}
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
});
