import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";

type BandHeaderProps = {
  /** Left mono label, e.g. "NET WORTH" / "MAY BURN" / "RECENT". */
  left: string;
  /** Right mono annotation, e.g. "30D" / "ON PACE" / "TODAY · YDA". */
  right: string;
  /** Right-side color override — defaults to bandSub's resting ink50. */
  rightColor?: string;
};

/**
 * Small label row atop a plain Money band (design README §Money: every band
 * opens with a left label + right annotation at bandSub size). Reused for
 * NET WORTH/30D, MAY BURN/ON PACE, and RECENT/TODAY · YDA.
 */
export function BandHeader({ left, right, rightColor }: BandHeaderProps) {
  const { t } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={t.bandSub}>{left}</Text>
      <Text style={[t.bandSub, rightColor != null && { color: rightColor }]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
