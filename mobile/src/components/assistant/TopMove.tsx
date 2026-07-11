import { StyleSheet, Text, View } from "react-native";

import { CheckIcon } from "../icons";
import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";

export type TopMoveStatus = "idle" | "pending" | "success" | "error";

type TopMoveProps = {
  tag: string;
  title: string;
  evidence: string;
  status: TopMoveStatus;
  /** `act()`'s result summary — shown in place of tag/title/evidence on success. */
  summary?: string | null;
  /** Inline error copy — shown under evidence; buttons stay live so APPLY can retry. */
  errorMessage?: string | null;
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
 *
 * `status` drives three live states (brief B6): `pending` disables both
 * pills while `act()` is in flight; `success` swaps the whole band to a
 * ✓ + summary line (mono, accent) — the caller auto-dismisses the sheet
 * ~1.2s later; `error` keeps tag/title/evidence + both pills (so APPLY can
 * retry) and adds an inline mono error line.
 */
export function TopMove({ tag, title, evidence, status, summary, errorMessage, onApply, onLater }: TopMoveProps) {
  const { c, t } = useTheme();
  const pending = status === "pending";

  if (status === "success") {
    return (
      <View style={[styles.band, { borderColor: c.bandBorder }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bandWash }]} />
        <View style={styles.successRow}>
          <CheckIcon size={13} color={c.accent} strokeWidth={2.4} />
          <Text style={[styles.successText, { color: c.accent }]}>{summary || "Done."}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.band, { borderColor: c.bandBorder }]}>
      {/* Flat rgba wash, not an SVG gradient — see Band.tsx (rn-svg drops the
          alpha off rgba() gradient stops on iOS and paints solid green). */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bandWash }]} />

      <Text style={t.bandLabel}>{tag}</Text>
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      <Text style={[styles.evidence, { color: c.ink50 }]}>{evidence}</Text>
      {status === "error" && errorMessage ? (
        <Text style={[styles.error, { color: c.red }]}>{errorMessage}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressed
          onPress={onApply}
          disabled={pending}
          // APPLY triggers an act() write — its real feedback is the success
          // buzz AssistantSheet fires on that call's resolution (see
          // fireSuccessHaptic in handleApplyTopMove), not a pressIn tick.
          haptic="success"
          style={[styles.pill, { backgroundColor: c.accent }, pending && styles.pillDisabled]}
        >
          <Text style={[styles.pillLabel, { color: c.onAccent }]}>{pending ? "APPLYING…" : "APPLY"}</Text>
        </Pressed>
        <Pressed
          onPress={onLater}
          disabled={pending}
          style={[styles.pill, styles.pillOutline, { borderColor: c.hairSection }, pending && styles.pillDisabled]}
        >
          <Text style={[styles.pillLabel, { color: c.ink64 }]}>LATER</Text>
        </Pressed>
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
  error: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
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
  pillDisabled: {
    opacity: 0.5,
  },
  pillLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  successText: {
    fontFamily: fonts.mono600,
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
