import { Pressable, StyleSheet, Text, View } from "react-native";

import { CheckIcon, LockIcon } from "../icons";
import type { PermissionExchange } from "../../data/capture";
import { color, font, glow, type } from "../../theme/tokens";

/**
 * Permission (write-back) card (spec §4 · §5.6 · §6.1) — the yellow-tinted
 * variant of the confirmation card. The agent does not fail when an action needs
 * an ungranted scope: it shows the pending change DIMMED, a yellow lock + "needs
 * access", a plain note, Grant (blue fill) + Not-now, and names the exact scope.
 * Attention-yellow, never error-red.
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
  const { before, bold, after } = splitNote(permission.note, permission.noteEmphasis);
  return (
    <View style={styles.card}>
      <View style={styles.tag}>
        <Text style={styles.module}>{permission.module}</Text>
        <Text style={styles.need}>needs access</Text>
        <View style={styles.lock}>
          <LockIcon size={13} color={color.yellow} />
        </View>
      </View>

      <View style={styles.pending}>
        <View>
          <Text style={type.rowTitle}>{permission.pending.title}</Text>
          <Text style={[type.microLabel, styles.pendingSub]}>{permission.pending.sub}</Text>
        </View>
        <Text style={styles.change}>
          <Text style={styles.from}>{permission.pending.from}</Text>
          <Text style={styles.to}>{`  → ${permission.pending.to}`}</Text>
        </Text>
      </View>

      <Text style={styles.note}>
        {before}
        <Text style={styles.noteBold}>{bold}</Text>
        {after}
      </Text>

      <View style={styles.acts}>
        <Pressable style={[styles.grant, glow(color.blue, 18, 0.3)]} onPress={onGrant}>
          <CheckIcon size={12} color={color.bg} strokeWidth={2.2} />
          <Text style={styles.grantLabel}>{permission.grantLabel}</Text>
        </Pressable>
        <Pressable style={styles.decline} onPress={onDecline}>
          <Text style={styles.declineLabel}>{permission.declineLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.scope}>
        <View style={styles.scopeCheck}>
          <CheckIcon size={8} color={color.bg} strokeWidth={3} />
        </View>
        <Text style={styles.scopeLabel}>{permission.scope}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(241,218,133,0.28)",
    borderRadius: 15,
    backgroundColor: "rgba(241,218,133,0.04)",
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
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: color.fg3,
    textTransform: "uppercase",
  },
  need: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: color.yellow,
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
  pendingSub: {
    color: color.fg4,
    marginTop: 3,
  },
  change: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  from: {
    color: color.fg4,
    textDecorationLine: "line-through",
    textDecorationColor: color.line2,
  },
  to: {
    color: color.fg3,
  },
  note: {
    fontFamily: font.sans,
    fontSize: 12.5,
    lineHeight: 20,
    color: color.fg2,
    marginTop: 13,
  },
  noteBold: {
    fontFamily: font.sansSemi,
    color: color.fg1,
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
    backgroundColor: color.blue,
  },
  grantLabel: {
    fontFamily: font.monoBold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: color.bg,
    textTransform: "uppercase",
  },
  decline: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: color.line2,
    justifyContent: "center",
  },
  declineLabel: {
    fontFamily: font.monoBold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: color.fg3,
    textTransform: "uppercase",
  },
  scope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderColor: color.line1,
  },
  scopeCheck: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeLabel: {
    fontFamily: font.monoSemi,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: color.fg4,
    textTransform: "uppercase",
  },
});
