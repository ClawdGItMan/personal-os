import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";

type BandMessageProps =
  | { kind: "empty"; text: string }
  | { kind: "error"; onRetry: () => void };

/**
 * Shared no-data / failed-load row for Body bands (Wave B mock-removal —
 * every live band needs a designed fallback; the design README has no spec
 * for this since it's new). Both variants reuse `t.bandSub` (mono,
 * uppercase-via-textTransform) — the system's existing meta-label voice
 * (e.g. the Assistant sheet's "AI · OFF") — rather than inventing a second
 * typographic register:
 * - `empty`: the literal copy (e.g. "No training this week"), auto-uppercased
 *   by the role like every other mono label in the system.
 * - `error`: terse status line "COULDN'T LOAD" + tappable accent "RETRY".
 */
export function BandMessage(props: BandMessageProps) {
  const { c, t } = useTheme();

  if (props.kind === "empty") {
    return <Text style={[t.bandSub, styles.text]}>{props.text}</Text>;
  }

  return (
    <View style={styles.errorRow}>
      <Text style={t.bandSub}>COULDN&apos;T LOAD</Text>
      <Pressable onPress={props.onRetry} hitSlop={8}>
        <Text style={[t.bandSub, { color: c.accent }]}> — RETRY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    marginTop: 10,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
});
