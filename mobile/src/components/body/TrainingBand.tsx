import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { Band } from "../spec/Band";
import { Pressed } from "../spec/Pressed";
import { BandMessage } from "./BandMessage";

type TrainingBandProps = {
  time: string;
  title: string;
  sub: string;
  /** Opens the workout's Detail page (kind: "workout"). */
  onPress?: () => void;
  index?: number;
};

/**
 * TRAINING · DONE band (design README §Body): accent band wrapper; the time
 * reads full ink in light mode and accent in dark mode (the one spec'd
 * exception to "times are always ink, never colored" — design README
 * §Typography / system-tokens.md's focus/training band rule). Tappable when
 * `onPress` is given → opens the shared Detail page for the latest workout.
 */
export function TrainingBand({ time, title, sub, onPress, index = 0 }: TrainingBandProps) {
  const { c, t, mode } = useTheme();
  return (
    <Band variant="accent" index={index}>
      <Pressed onPress={onPress} disabled={!onPress}>
        <View style={styles.row}>
          <Text style={t.bandLabel}>TRAINING · DONE</Text>
          <Text style={[styles.time, { color: mode === "light" ? c.ink : c.accent }]}>{time}</Text>
        </View>
        <Text style={[t.bandTitle, styles.title]}>{title}</Text>
        <Text style={[t.bandSub, styles.sub]}>{sub}</Text>
      </Pressed>
    </Band>
  );
}

/** No workout logged in the last 7 days (or `useWorkouts` hasn't returned one
 * yet) — plain-variant band replacing the accent TRAINING band. */
export function TrainingEmptyBand({ index = 0 }: { index?: number }) {
  const { t } = useTheme();
  return (
    <Band variant="plain" index={index}>
      <Text style={t.sectionHeader}>TRAINING</Text>
      <BandMessage kind="empty" text="No training this week" />
    </Band>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  title: {
    marginTop: 10,
  },
  sub: {
    marginTop: 6,
  },
});
