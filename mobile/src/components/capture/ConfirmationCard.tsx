import { Pressable, StyleSheet, Text, View } from "react-native";

import { LiftRow } from "../LiftRow";
import { CheckIcon, UndoIcon } from "../icons";
import { EditIcon } from "./captureIcons";
import type { ConfirmationExchange } from "../../data/capture";
import { color, font, type } from "../../theme/tokens";

/**
 * Confirmation card (spec §4 · §5.6) — the most reusable cross-module piece.
 * Hairline card: module tag (tinted by destination) + ✓; the parsed entry
 * rendered in the destination module's OWN row grammar (a shared LiftRow for
 * Body, an inline time-change for Calendar); a one-line agent note; Undo +
 * Edit/View footer chips. Capture composes other modules' rows — almost no
 * bespoke UI of its own.
 */
type ConfirmationCardProps = {
  exchange: ConfirmationExchange;
  onUndo?: () => void;
  onSecondary?: () => void;
};

export function ConfirmationCard({ exchange, onUndo, onSecondary }: ConfirmationCardProps) {
  const accent = exchange.accent === "blue" ? color.blue : color.green;
  return (
    <View style={styles.card}>
      <View style={styles.tag}>
        <Text style={[styles.module, { color: accent }]}>{exchange.module}</Text>
        <Text style={styles.verb}>{exchange.verb}</Text>
        <View style={styles.check}>
          <CheckIcon size={13} color={accent} strokeWidth={2.4} />
        </View>
      </View>

      {exchange.entry.kind === "lift" ? (
        <View style={styles.entry}>
          <LiftRow
            name={exchange.entry.name}
            scheme={exchange.entry.scheme}
            weight={exchange.entry.weight}
            unit={exchange.entry.unit}
            pr={exchange.entry.pr}
            last
          />
        </View>
      ) : (
        <View style={styles.changeRow}>
          <View>
            <Text style={type.rowTitle}>{exchange.entry.title}</Text>
            <Text style={[type.microLabel, styles.changeSub]}>{exchange.entry.sub}</Text>
          </View>
          <Text style={styles.change}>
            <Text style={styles.from}>{exchange.entry.from}</Text>
            <Text style={styles.to}>{`  → ${exchange.entry.to}`}</Text>
          </Text>
        </View>
      )}

      <Text style={styles.note}>{exchange.note}</Text>

      <View style={styles.chips}>
        <Pressable style={styles.chip} onPress={onUndo} hitSlop={6}>
          <UndoIcon size={11} color={color.fg3} />
          <Text style={styles.chipLabel}>Undo</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={onSecondary} hitSlop={6}>
          <EditIcon size={11} color={color.fg3} />
          <Text style={styles.chipLabel}>{exchange.secondary === "view" ? "View" : "Edit"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: color.line1,
    borderRadius: 15,
    backgroundColor: "rgba(20,23,28,0.5)",
    paddingHorizontal: 15,
    paddingVertical: 13,
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
    textTransform: "uppercase",
  },
  verb: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: color.fg4,
    textTransform: "uppercase",
  },
  check: {
    marginLeft: "auto",
  },
  entry: {
    marginTop: 2,
  },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  changeSub: {
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
    color: color.blue,
  },
  note: {
    fontFamily: font.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: color.fg2,
    marginTop: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: color.line2,
    borderRadius: 9,
  },
  chipLabel: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.7,
    color: color.fg3,
    textTransform: "uppercase",
  },
});
