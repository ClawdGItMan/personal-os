import { StyleSheet, Text, View } from "react-native";

import type { SeeingItem } from "../../data/assistant";
import { CheckIcon } from "../icons";
import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type SeeingRowProps = {
  item: SeeingItem;
  first: boolean;
  onAction: () => void;
};

/**
 * ALSO SEEING row (design README §Assistant sheet) — a 52pt tag | 1fr | pill
 * grid. components/spec/LedgerRow is a 58pt-time | 1fr | auto grid built for
 * timeline rows (marker dot + strike-through), which doesn't fit a domain tag
 * + action pill, so this is its own row (foundation note, brief B5).
 *
 * `item.status` (brief B6): `pending` dims the pill and disables it while
 * `act()` runs; `success` swaps the pill to a ✓ badge; `error` reverts the
 * pill to its normal pressable label (so the row can retry) and adds a small
 * inline mono error line under the sub.
 */
export function SeeingRow({ item, first, onAction }: SeeingRowProps) {
  const { c, t } = useTheme();
  const accentAction = item.actionTone === "accent";
  const pending = item.status === "pending";
  const success = item.status === "success";

  return (
    <View style={[styles.row, { borderTopColor: first ? c.hairSection : c.hairRow }]}>
      <Text style={[styles.tag, { color: c.ink50 }]}>{item.tag}</Text>
      <View style={styles.body}>
        <Text style={t.ledgerTitle}>{item.title}</Text>
        <Text style={[t.bandSub, styles.sub]}>{item.sub}</Text>
        {item.status === "error" && item.errorMessage ? (
          <Text style={[styles.error, { color: c.red }]}>{item.errorMessage}</Text>
        ) : null}
      </View>
      {success ? (
        <View style={[styles.pill, styles.pillDone, { borderColor: c.accent }]}>
          <CheckIcon size={11} color={c.accent} strokeWidth={2.4} />
        </View>
      ) : (
        <Pressed
          onPress={onAction}
          disabled={pending}
          // A tool-backed row is an act() write — its real feedback is the
          // success buzz AssistantSheet fires when that call resolves (see
          // fireSuccessHaptic in handleAlsoSeeingAction), not a pressIn tick.
          haptic={item.tool ? "success" : "selection"}
          style={[styles.pill, { borderColor: accentAction ? c.accent : c.hairSection }, pending && styles.pillPending]}
        >
          <Text style={[styles.pillLabel, { color: accentAction ? c.accent : c.ink64 }]}>
            {pending ? "···" : item.action}
          </Text>
        </Pressed>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  tag: {
    width: 52,
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 4,
  },
  error: {
    fontFamily: fonts.mono500,
    fontSize: 8.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 5,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  pillPending: {
    opacity: 0.5,
  },
  pillDone: {
    width: 26,
    height: 26,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pillLabel: {
    fontFamily: fonts.mono600,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
