import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SheetFadeUp } from "../assistant/SheetFadeUp";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type SettingsSectionProps = {
  title: string;
  /** Non-tappable caption under the section — INTEGRATIONS' "MANAGE ON WEB". */
  caption?: string;
  /** SheetFadeUp stagger slot (clamped to its last delay past index 5, same
   * as AssistantSheet's own sections — Settings has more sections than the
   * sheet's 6-slot ramp has room for). */
  index: number;
  children: ReactNode;
};

/**
 * A labeled Settings section (task C3) — mono section header (matches
 * FocusScreen's "This week"/"Queue" band headers) above a row list. Rows
 * supply their own leading hairline (`first` prop) instead of this wrapping
 * them in a bordered Band, mirroring the Assistant sheet's ALSO SEEING
 * section (header + SeeingRow list, no enclosing card) — the design system's
 * "no cards" rule extends to Settings.
 */
export function SettingsSection({ title, caption, index, children }: SettingsSectionProps) {
  const { c, t } = useTheme();
  return (
    <SheetFadeUp index={index} style={styles.wrap}>
      <Text style={t.sectionHeader}>{title}</Text>
      <View style={styles.rows}>{children}</View>
      {caption ? <Text style={[styles.caption, { color: c.ink34 }]}>{caption}</Text> : null}
    </SheetFadeUp>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 26,
  },
  rows: {
    marginTop: 8,
  },
  caption: {
    fontFamily: fonts.mono500,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 10,
  },
});
