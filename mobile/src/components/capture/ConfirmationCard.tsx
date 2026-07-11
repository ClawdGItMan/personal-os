import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ConfirmationExchange } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { LiftRow } from "../LiftRow";
import { CheckIcon, UndoIcon } from "../icons";
import { EditIcon } from "./captureIcons";

/**
 * Confirmation card (spec §4 · §5.6) — the most reusable cross-module piece.
 * Hairline card: module tag + ✓; the parsed entry rendered in the destination
 * module's OWN row grammar (a shared LiftRow for Body, an inline time-change
 * for Calendar); a one-line agent note; Undo + Edit/View footer chips. The
 * legacy per-module green/blue accents collapse onto the single new-system
 * accent — Capture composes other modules' rows — almost no bespoke UI of its
 * own.
 */
type ConfirmationCardProps = {
  exchange: ConfirmationExchange;
  onUndo?: () => void;
  onSecondary?: () => void;
};

export function ConfirmationCard({ exchange, onUndo, onSecondary }: ConfirmationCardProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { borderColor: c.hairRow, backgroundColor: c.surface }]}>
      <View style={styles.tag}>
        <Text style={[styles.module, { color: c.accent }]}>{exchange.module}</Text>
        <Text style={[styles.verb, { color: c.ink38 }]}>{exchange.verb}</Text>
        <View style={styles.check}>
          <CheckIcon size={13} color={c.accent} strokeWidth={2.4} />
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
            <Text style={[styles.entryTitle, { color: c.ink }]}>{exchange.entry.title}</Text>
            <Text style={[styles.changeSub, { color: c.ink38 }]}>{exchange.entry.sub}</Text>
          </View>
          <Text style={styles.change}>
            <Text style={[styles.from, { color: c.ink38, textDecorationColor: c.hairSection }]}>
              {exchange.entry.from}
            </Text>
            <Text style={{ color: c.accent }}>{`  → ${exchange.entry.to}`}</Text>
          </Text>
        </View>
      )}

      <Text style={[styles.note, { color: c.ink72 }]}>{exchange.note}</Text>

      <View style={styles.chips}>
        <Pressable style={[styles.chip, { borderColor: c.hairSection }]} onPress={onUndo} hitSlop={6}>
          <UndoIcon size={11} color={c.ink50} />
          <Text style={[styles.chipLabel, { color: c.ink50 }]}>Undo</Text>
        </Pressable>
        <Pressable style={[styles.chip, { borderColor: c.hairSection }]} onPress={onSecondary} hitSlop={6}>
          <EditIcon size={11} color={c.ink50} />
          <Text style={[styles.chipLabel, { color: c.ink50 }]}>
            {exchange.secondary === "view" ? "View" : "Edit"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 15,
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
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  verb: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
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
  entryTitle: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    letterSpacing: -0.15,
  },
  changeSub: {
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
    lineHeight: 19,
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
    borderRadius: 9,
  },
  chipLabel: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
