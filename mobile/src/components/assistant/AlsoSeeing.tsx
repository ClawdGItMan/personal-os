import { StyleSheet, Text, View } from "react-native";

import type { SeeingItem } from "../../data/assistant";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { SeeingRow } from "./SeeingRow";

type AlsoSeeingProps = {
  items: SeeingItem[];
  /** `index` lets the caller key per-row `act()` pending/success/error state
   * back to the source `also_seeing` array (rows have no stable server id). */
  onAction: (item: SeeingItem, index: number) => void;
};

/** ALSO SEEING ledger (design README §Assistant sheet): section header + count, then SeeingRow list. */
export function AlsoSeeing({ items, onAction }: AlsoSeeingProps) {
  const { c, t } = useTheme();
  return (
    <View>
      <View style={styles.header}>
        <Text style={t.sectionHeader}>ALSO SEEING</Text>
        <Text style={[styles.count, { color: c.ink50 }]}>{items.length}</Text>
      </View>
      {items.map((item, i) => (
        <SeeingRow key={`${item.tag}-${i}`} item={item} first={i === 0} onAction={() => onAction(item, i)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  count: {
    fontFamily: fonts.mono500,
    fontSize: 11,
  },
});
