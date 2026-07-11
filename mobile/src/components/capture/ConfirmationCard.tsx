import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CaptureConfirmation } from "./useCaptureSession";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { CheckIcon, UndoIcon } from "../icons";

/**
 * Confirmation card (spec §4 · §5.6) — the agent's real write-tool result: a
 * hairline card with a module tag + check, the tool's own one-line summary,
 * and an Undo chip when the result named an undoable row. Tapping Undo
 * deletes that row directly (allowlisted table, RLS-scoped) and the card
 * flips to its "Undone" state. Chrome is the locked design's — only the
 * content (module/summary/undo) is real now; there's no more per-module row
 * grammar (LiftRow/change-row) because the tool result is just a summary
 * string, not structured data.
 */
type ConfirmationCardProps = {
  confirmation: CaptureConfirmation;
  onUndo?: () => void;
};

export function ConfirmationCard({ confirmation, onUndo }: ConfirmationCardProps) {
  const { c } = useTheme();
  const { moduleLabel, summary, undoRef, undone } = confirmation;

  return (
    <View style={[styles.card, { borderColor: c.hairRow, backgroundColor: c.surface }]}>
      <View style={styles.tag}>
        <Text style={[styles.module, { color: undone ? c.ink38 : c.accent }]}>{moduleLabel}</Text>
        <Text style={[styles.verb, { color: c.ink38 }]}>{undone ? "undone" : "logged"}</Text>
        <View style={styles.check}>
          <CheckIcon size={13} color={undone ? c.ink38 : c.accent} strokeWidth={2.4} />
        </View>
      </View>

      <Text style={[styles.summary, { color: undone ? c.ink38 : c.ink }]}>{summary}</Text>

      {undoRef ? (
        <View style={styles.chips}>
          <Pressable
            style={[styles.chip, { borderColor: c.hairSection }, undone && styles.chipDone]}
            onPress={undone ? undefined : onUndo}
            disabled={undone}
            hitSlop={6}
          >
            <UndoIcon size={11} color={c.ink50} />
            <Text style={[styles.chipLabel, { color: c.ink50 }]}>{undone ? "Undone" : "Undo"}</Text>
          </Pressable>
        </View>
      ) : null}
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
  summary: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.15,
    marginTop: 10,
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
  chipDone: {
    opacity: 0.5,
  },
  chipLabel: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
