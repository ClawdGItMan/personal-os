import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";

type TopMoveProps = {
  tag: string;
  title: string;
  evidence: string;
  onApply: () => void;
  onLater: () => void;
};

/**
 * TOP MOVE accent band (design README §Assistant sheet) — the sheet's single
 * ranked recommendation. Recreates components/spec/Band's accent border +
 * gradient wash in place (rather than importing it) so this section can run
 * on the sheet's own SheetFadeUp slot instead of Band's built-in home-ramp
 * FadeUp (brief B5: "LedgerRow may not fit... build your own" applies here
 * for the same reason — the stagger ramps don't match).
 */
export function TopMove({ tag, title, evidence, onApply, onLater }: TopMoveProps) {
  const { c, t } = useTheme();

  return (
    <View style={[styles.band, { borderColor: c.bandBorder }]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" width="100%" height="100%">
        <Defs>
          <LinearGradient id="topMoveWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.bandGrad0} />
            <Stop offset="1" stopColor={c.bandGrad1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#topMoveWash)" />
      </Svg>

      <Text style={t.bandLabel}>{tag}</Text>
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      <Text style={[styles.evidence, { color: c.ink50 }]}>{evidence}</Text>

      <View style={styles.actions}>
        <Pressable onPress={onApply} style={[styles.pill, { backgroundColor: c.accent }]}>
          <Text style={[styles.pillLabel, { color: c.onAccent }]}>APPLY</Text>
        </Pressable>
        <Pressable onPress={onLater} style={[styles.pill, styles.pillOutline, { borderColor: c.hairSection }]}>
          <Text style={[styles.pillLabel, { color: c.ink64 }]}>LATER</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: layout.bandPadV,
    paddingHorizontal: layout.gutter,
    overflow: "hidden",
  },
  title: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    letterSpacing: -0.3,
    marginTop: 9,
  },
  evidence: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    marginTop: 7,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: layout.radius.pill,
  },
  pillOutline: {
    borderWidth: 1,
  },
  pillLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
