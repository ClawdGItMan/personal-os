import { StyleSheet, Text, View } from "react-native";

import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type BandHeaderProps = {
  /** Left mono label, e.g. "NET WORTH" / "MAY BURN" / "RECENT". */
  left: string;
  /** Right mono annotation, e.g. "30D" / "ON PACE" / "TODAY · YDA". */
  right: string;
  /** Right-side color override — defaults to bandSub's resting ink50. */
  rightColor?: string;
  /** Trailing "+" affordance (RECENT band's add-transaction action). */
  onAdd?: () => void;
};

/**
 * Small label row atop a plain Money band (design README §Money: every band
 * opens with a left label + right annotation at bandSub size). Reused for
 * NET WORTH/30D, MAY BURN/ON PACE, and RECENT/TODAY · YDA. `onAdd` renders a
 * trailing "+" glyph after the right annotation (mono, ink50 — no new icon
 * asset, mirrors the existing +/- glyph usage in ledger amounts).
 */
export function BandHeader({ left, right, rightColor, onAdd }: BandHeaderProps) {
  const { c, t } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={t.bandSub}>{left}</Text>
      <View style={styles.rightGroup}>
        <Text style={[t.bandSub, rightColor != null && { color: rightColor }]}>{right}</Text>
        {onAdd ? (
          <Pressed accessibilityLabel="Add" onPress={onAdd} hitSlop={8} style={styles.addButton}>
            <Text style={[styles.addGlyph, { color: c.ink50 }]}>+</Text>
          </Pressed>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addButton: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addGlyph: {
    fontFamily: fonts.mono600,
    fontSize: 13,
    marginTop: -1,
  },
});
