import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { formatElapsed, formatHHMM12h } from "../../data/focus";
import { time12 } from "../../lib/format";
import { Shimmer } from "../../motion/Shimmer";
import { useFillAnim } from "../../motion/useFillAnim";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";
import { Band } from "../spec/Band";

type LiveTimerBandProps = {
  /** Ticking clock ms (drives the header's live "H:MM AM/PM" readout). */
  nowMs: number;
  elapsedSec: number;
  /** Fixed block end, 24h "HH:MM" local. */
  endsAt: string;
  label: string;
  /** Block progress 0–1 — drives the fill + the shimmer width. */
  pct: number;
  index?: number;
};

/**
 * Focus's LIVE band (spec §7c) — the live deep-work timer + progress fill
 * (mock session, no provider yet; elapsed/pct come from FocusScreen's timer
 * math off the shared `nowMs` tick). Extracted out of FocusScreen.tsx to keep
 * the screen render-only.
 */
export function LiveTimerBand({ nowMs, elapsedSec, endsAt, label, pct, index = 0 }: LiveTimerBandProps) {
  const { c, t, mode } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillStyle = useFillAnim(pct * 100);

  return (
    <Band variant="accent" index={index}>
      <View style={styles.headerRow}>
        <Text style={t.bandLabel}>Live · Deep work</Text>
        <Text style={[styles.clock, { color: mode === "dark" ? c.accent : c.ink }]}>
          {time12(new Date(nowMs))}
        </Text>
      </View>
      <View style={styles.timerRow}>
        <Text style={t.timerValue}>{formatElapsed(elapsedSec)}</Text>
        <Text style={t.bandSub}>{`Ends ${formatHHMM12h(endsAt)}`}</Text>
      </View>
      <Text style={[styles.sessionSub, { color: c.ink64 }]}>{label}</Text>
      <View
        style={[styles.progressTrack, { backgroundColor: c.dayTrack }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.progressFill, { backgroundColor: c.accent }, fillStyle]}>
          <Shimmer width={trackWidth * pct} />
        </Animated.View>
      </View>
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
});
