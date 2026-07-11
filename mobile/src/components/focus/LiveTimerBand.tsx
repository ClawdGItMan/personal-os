import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { focusElapsedSec, focusEndsAtMs, focusIsOvertime, focusPct, formatElapsed } from "../../data/focus";
import { time12 } from "../../lib/format";
import type { ActiveFocusSession } from "../../lib/queries";
import { Shimmer } from "../../motion/Shimmer";
import { useFillAnim } from "../../motion/useFillAnim";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";
import { Band } from "../spec/Band";
import { Pressed } from "../spec/Pressed";
import { Skeleton } from "../spec/Skeleton";

/** How long the first tap's "TAP AGAIN TO END" confirm affordance stays up. */
const CONFIRM_END_MS = 3000;

type LiveTimerBandProps = {
  /** Ticking clock ms — drives the live elapsed/progress math below. */
  nowMs: number;
  /** The running session, or null when nothing is active (renders the START state). */
  active: ActiveFocusSession | null;
  /** True while useFocusSessions has no data yet — renders a skeleton instead
   * of guessing START/LIVE (avoids a wrong-state flash before the first fetch resolves). */
  loading: boolean;
  /** Starts a new session — called on tap when there's no active session. */
  onStart: () => void;
  /** Ends the active session — called on the *second* tap of the confirm affordance. */
  onEnd: () => void;
  index?: number;
};

/**
 * Focus's LIVE/START band (spec §7c) — LIVE: live deep-work timer + progress
 * fill, elapsed/pct/overtime derived from `active.startedAt` against the
 * shared `nowMs` tick (see data/focus.ts's focusElapsedSec/focusPct/
 * focusIsOvertime/focusEndsAtMs — pure, reusable). Overtime keeps the bar
 * full and turns the timer value amber. Tap-to-end is a two-tap in-band
 * confirm (no Alert.alert): first tap swaps "Ends H:MM" to "TAP AGAIN TO
 * END" for 3s; a second tap within that window calls `onEnd`. START: no
 * active session — plain label/title/sub, tap calls `onStart`. Extracted out
 * of FocusScreen.tsx to keep the screen render-only.
 */
export function LiveTimerBand({ nowMs, active, loading, onStart, onEnd, index = 0 }: LiveTimerBandProps) {
  const { c, t, mode } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the confirm affordance whenever the active session changes (ended
  // elsewhere, or a new one started) so it never carries over stale state.
  useEffect(() => {
    setConfirmingEnd(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, [active?.id]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const elapsedSec = active ? focusElapsedSec(active.startedAt, nowMs) : 0;
  const pct = active ? focusPct(elapsedSec, active.plannedMinutes) : 0;
  const overtime = active ? focusIsOvertime(elapsedSec, active.plannedMinutes) : false;
  const endsAtMs = active ? focusEndsAtMs(active.startedAt, active.plannedMinutes) : null;
  const fillStyle = useFillAnim(pct * 100);

  function handlePress() {
    if (loading) return;
    if (!active) {
      onStart();
      return;
    }
    if (confirmingEnd) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmingEnd(false);
      onEnd();
      return;
    }
    setConfirmingEnd(true);
    confirmTimer.current = setTimeout(() => setConfirmingEnd(false), CONFIRM_END_MS);
  }

  if (loading) {
    return (
      <Band variant="accent" index={index}>
        <View style={styles.headerRow}>
          <Skeleton width={90} height={9} radius={2} />
          <Skeleton width={54} height={12} radius={2} />
        </View>
        <View style={styles.timerRow}>
          <Skeleton width={140} height={30} radius={4} />
        </View>
        <View style={styles.loadingSubGap}>
          <Skeleton width={160} height={10} radius={2} />
        </View>
      </Band>
    );
  }

  return (
    <Band variant="accent" index={index}>
      <Pressed
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={active ? "End focus session" : "Start deep work"}
      >
        {active ? (
          <>
            <View style={styles.headerRow}>
              <Text style={t.bandLabel}>Live · Deep work</Text>
              <Text style={[styles.clock, { color: mode === "dark" ? c.accent : c.ink }]}>
                {time12(new Date(nowMs))}
              </Text>
            </View>
            <View style={styles.timerRow}>
              <Text style={[t.timerValue, overtime && { color: c.amber }]}>{formatElapsed(elapsedSec)}</Text>
              <Text style={t.bandSub}>
                {confirmingEnd ? "TAP AGAIN TO END" : `Ends ${time12(new Date(endsAtMs ?? nowMs))}`}
              </Text>
            </View>
            <Text style={[styles.sessionSub, { color: c.ink64 }]}>{active.label}</Text>
            <View
              style={[styles.progressTrack, { backgroundColor: c.dayTrack }]}
              onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View style={[styles.progressFill, { backgroundColor: c.accent }, fillStyle]}>
                <Shimmer width={trackWidth * pct} />
              </Animated.View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={t.bandLabel}>Focus</Text>
            </View>
            <Text style={[t.bandTitle, styles.startTitle]}>Start deep work</Text>
            <Text style={[t.bandSub, styles.startSub]}>50 MIN · TAP TO BEGIN</Text>
          </>
        )}
      </Pressed>
    </Band>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clock: {
    fontFamily: fonts.mono600,
    fontSize: 14,
    letterSpacing: -0.28,
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
  },
  sessionSub: {
    fontFamily: fonts.sans500,
    fontSize: 13,
    marginTop: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: layout.radius.pill,
    marginTop: 15,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: layout.radius.pill,
    overflow: "hidden",
  },
  startTitle: {
    marginTop: 10,
  },
  startSub: {
    marginTop: 6,
  },
  loadingSubGap: {
    marginTop: 15,
  },
});
