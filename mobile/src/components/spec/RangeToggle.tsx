import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { ENTER_EASING } from "../../motion/FadeUp";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";
import { Pressed } from "./Pressed";

/** The three windows every progressive-trend chart in the app can show
 * (task C4). Individual toggles pick a subset via `options` (e.g. Money's
 * net worth band only offers 30/90). */
export type RangeDays = 7 | 30 | 90;

const ALL_OPTIONS: RangeDays[] = [7, 30, 90];

/** Fixed per-option width (px) — deterministic so the underline's position
 * doesn't depend on measuring the row's rendered width (labels are short and
 * fixed-format, "7D"/"30D"/"90D", so a shared width reads as evenly spaced
 * regardless of digit count). */
const OPTION_WIDTH = 30;

type RangeToggleProps = {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
  /** Subset/order of options to render; defaults to all three. */
  options?: RangeDays[];
};

/**
 * Mono pill row range selector (task C4, design tokens only — no cards, no
 * hardcoded colors). Each option is a small mono label; an accent underline
 * slides beneath the active one via Reanimated `withTiming` (honors
 * `useReducedMotion` by snapping instead of sliding). Tap targets go through
 * the shared `Pressed` component for the standard press physics + selection
 * haptic.
 */
export function RangeToggle({ value, onChange, options = ALL_OPTIONS }: RangeToggleProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const activeIndex = Math.max(0, options.indexOf(value));
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    progress.value = reduceMotion ? activeIndex : withTiming(activeIndex, { duration: 260, easing: ENTER_EASING });
  }, [activeIndex, progress, reduceMotion]);

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * OPTION_WIDTH }],
  }));

  return (
    <View style={[styles.wrap, { width: OPTION_WIDTH * options.length }]}>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressed
              key={opt}
              onPress={() => onChange(opt)}
              hitSlop={6}
              style={styles.option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt} days`}
            >
              <Text style={[styles.label, { color: active ? c.ink : c.ink38 }]}>{opt}D</Text>
            </Pressed>
          );
        })}
      </View>
      <View style={[styles.track, { backgroundColor: c.hairRow }]}>
        <Animated.View style={[styles.underline, { backgroundColor: c.accent }, underlineStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: "row",
  },
  option: {
    width: OPTION_WIDTH,
    alignItems: "center",
    paddingVertical: 4,
  },
  label: {
    fontFamily: fonts.mono600,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  track: {
    height: 1,
    marginTop: 2,
    overflow: "hidden",
  },
  underline: {
    position: "absolute",
    top: -0.5,
    width: OPTION_WIDTH,
    height: 2,
    borderRadius: layout.radius.pill,
  },
});
