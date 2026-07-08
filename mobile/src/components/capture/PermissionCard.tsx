import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PermissionExchange } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { CheckIcon, LockIcon } from "../icons";

/**
 * Permission (write-back) card (spec §4 · §5.6 · §6.1) — the amber-tinted
 * variant of the confirmation card. The agent does not fail when an action needs
 * an ungranted scope: it shows the pending change DIMMED, an amber lock + "needs
 * access", a plain note, Grant (accent fill) + Not-now, and names the exact scope.
 * Attention-amber, never error-red.
 */
type PermissionCardProps = {
  permission: PermissionExchange;
  onGrant?: () => void;
  onDecline?: () => void;
};

function splitNote(note: string, emphasis: string) {
  const at = note.indexOf(emphasis);
  if (at < 0) return { before: note, bold: "", after: "" };
  return { before: note.slice(0, at), bold: emphasis, after: note.slice(at + emphasis.length) };
}

export function PermissionCard({ permission, onGrant, onDecline }: PermissionCardProps) {
  const { c, mode } = useTheme();
  // Amber tint isn't a shared palette role — same rgba-per-mode pattern as the accent rings.
  const amberBorder = mode === "light" ? "rgba(168,132,43,0.3)" : "rgba(201,164,92,0.3)";
  const amberWash = mode === "light" ? "rgba(168,132,43,0.05)" : "rgba(201,164,92,0.05)";
  const { before, bold, after } = splitNote(permission.note, permission.noteEmphasis);
  return (
    <View style={[styles.card, { borderColor: amberBorder, backgroundColor: amberWash }]}>
      <View style={styles.tag}>
        <Text style={[styles.module, { color: c.ink50 }]}>{permission.module}</Text>
        <Text style={[styles.need, { color: c.amber }]}>needs access</Text>
        <View style={styles.lock}>
          <LockIcon size={13} color={c.amber} />
        </View>
      </View>

      <View style={styles.pending}>
        <View>
          <Text style={[styles.pendingTitle, { color: c.ink }]}>{permission.pending.title}</Text>
          <Text style={[styles.pendingSub, { color: c.ink38 }]}>{permission.pending.sub}</Text>
        </View>
        <Text style={styles.change}>
          <Text style={[styles.from, { color: c.ink38, textDecorationColor: c.hairSection }]}>
            {permission.pending.from}
          </Text>
          <Text style={{ color: c.ink50 }}>{`  → ${permission.pending.to}`}</Text>
        </Text>
      </View>

      <Text style={[styles.note, { color: c.ink72 }]}>
        {before}
        <Text style={[styles.noteBold, { color: c.ink }]}>{bold}</Text>
        {after}
      </Text>

      <View style={styles.acts}>
        <Pressable style={[styles.grant, { backgroundColor: c.accent }]} onPress={onGrant}>
          <CheckIcon size={12} color={c.onAccent} strokeWidth={2.2} />
          <Text style={[styles.grantLabel, { color: c.onAccent }]}>{permission.grantLabel}</Text>
        </Pressable>
        <Pressable style={[styles.decline, { borderColor: c.hairSection }]} onPress={onDecline}>
          <Text style={[styles.declineLabel, { color: c.ink50 }]}>{permission.declineLabel}</Text>
        </Pressable>
      </View>

      <View style={[styles.scope, { borderColor: c.hairRow }]}>
        <View style={[styles.scopeCheck, { backgroundColor: c.accent }]}>
          <CheckIcon size={8} color={c.onAccent} strokeWidth={3} />
        </View>
        <Text style={[styles.scopeLabel, { color: c.ink38 }]}>{permission.scope}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginTop: 13,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  module: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  need: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  lock: {
    marginLeft: "auto",
  },
  pending: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    opacity: 0.6,
  },
  pendingTitle: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    letterSpacing: -0.15,
  },
  pendingSub: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 3,
  },
  change: {
    fontFamily: fonts.mono500,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  from: {
    textDecorationLine: "line-through",
  },
  note: {
    fontFamily: fonts.sans400,
    fontSize: 12.5,
    lineHeight: 20,
    marginTop: 13,
  },
  noteBold: {
    fontFamily: fonts.sans600,
  },
  acts: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },
  grant: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 11,
  },
  grantLabel: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  decline: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
  },
  declineLabel: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  scope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
  },
  scopeCheck: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeLabel: {
    fontFamily: fonts.mono500,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
