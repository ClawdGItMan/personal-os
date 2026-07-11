import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useTheme } from "../../theme/ThemeContext";
import { Pressed } from "../spec/Pressed";

export type ToggleRowProps = {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  first?: boolean;
  disabled?: boolean;
};

const TRACK_W = 38;
const TRACK_H = 21;
const THUMB = 15;
const PAD = 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;
const SPRING = { damping: 18, stiffness: 220 };

/**
 * Binary toggle row (task C3: Morning Brief, per-calendar selection). The
 * locked design system has no Switch equivalent — a native iOS `Switch`'s
 * system blue/green chrome would break the "no blue anywhere" / mono
 * spec-sheet rule — so this is a small hand-built track + thumb in the
 * theme's accent color, sized to sit inline the way LedgerRow's done/up
 * marker square does. The whole row is the tap target, not just the track
 * (same "row is the button" convention as LiveTimerBand/SeeingRow).
 */
export function ToggleRow({ label, sub, value, onChange, first, disabled }: ToggleRowProps) {
  const { c, t } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SPRING);
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, TRAVEL]) }],
  }));

  return (
    <Pressed
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, { borderTopColor: first ? c.hairSection : c.hairRow }, disabled && styles.disabled]}
    >
      <View style={styles.body}>
        <Text style={t.ledgerTitle} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[t.bandSub, styles.sub]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.track,
          { borderColor: value ? c.accent : c.hairSection, backgroundColor: value ? c.bandWash : "transparent" },
        ]}
      >
        <Animated.View style={[styles.thumb, { backgroundColor: value ? c.accent : c.ink28 }, thumbStyle]} />
      </View>
    </Pressed>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  body: {
    flex: 1,
  },
  sub: {
    marginTop: 4,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1,
    padding: PAD,
    justifyContent: "center",
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
});
