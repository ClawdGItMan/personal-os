import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { Pressed } from "../spec/Pressed";

export type SettingsRowProps = {
  label: string;
  sub?: string;
  labelColor?: string;
  subColor?: string;
  /** Trailing accessory — a chevron, a status dot, a lock icon. */
  right?: ReactNode;
  /** Omit for a static/informational row (email display, ABOUT lines) — a
   * static row is rendered as a plain `View`, not wrapped in `Pressed`, so it
   * never fires a stray selection-tap haptic on touch. */
  onPress?: () => void;
  disabled?: boolean;
  /** "default" = sans row title (matches LedgerRow/SeeingRow's title style) ·
   * "cta" = mono uppercase accent, for actionable rows like "ALLOW CALENDAR
   * ACCESS" (matches MoneyScreen's empty-state "+ Add your first account"
   * mono CTA idiom). */
  variant?: "default" | "cta";
  /** True on the first row of a section — draws the section's stronger
   * leading hairline (Band.tsx: "the section header above supplies the
   * stronger leading hairline; rows carry the faint row rule"); later rows
   * get the faint inter-row rule. */
  first?: boolean;
};

/**
 * Generic Settings row (task C3) — label + optional sub + optional trailing
 * accessory, spec-sheet ledger styling (mirrors SeeingRow/LedgerRow's row
 * grammar: hairline-topped rows, no cards). The base every Settings section
 * row is built from; ToggleRow is a sibling variant with a track/thumb
 * accessory baked in instead of an arbitrary `right` node.
 */
export function SettingsRow({
  label,
  sub,
  labelColor,
  subColor,
  right,
  onPress,
  disabled,
  variant = "default",
  first,
}: SettingsRowProps) {
  const { c, t } = useTheme();
  const isCta = variant === "cta";

  const content = (
    <>
      <View style={styles.body}>
        <Text
          style={[isCta ? styles.ctaLabel : t.ledgerTitle, { color: labelColor ?? (isCta ? c.accent : c.ink) }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={[t.bandSub, styles.sub, subColor ? { color: subColor } : null]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );

  const rowStyle = [styles.row, { borderTopColor: first ? c.hairSection : c.hairRow }, disabled && styles.disabled];

  if (onPress) {
    return (
      <Pressed onPress={onPress} disabled={disabled} style={rowStyle}>
        {content}
      </Pressed>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

/** Small status dot for the INTEGRATIONS section (green/amber/red — caller
 * resolves the color from the active palette). */
export function StatusDot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 4,
  },
  ctaLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
