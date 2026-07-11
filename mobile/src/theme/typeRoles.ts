import type { TextStyle } from "react-native";

import type { Palette } from "./palette";

/**
 * Font families — Manrope for UI text, Geist Mono for all data/labels/times
 * (design README §Typography). Names follow expo-google-fonts convention.
 */
export const fonts = {
  sans400: "Manrope_400Regular",
  sans500: "Manrope_500Medium",
  sans600: "Manrope_600SemiBold",
  sans700: "Manrope_700Bold",
  mono400: "GeistMono_400Regular",
  mono500: "GeistMono_500Medium",
  mono600: "GeistMono_600SemiBold",
} as const;

export type TypeRoles = {
  wordmark: TextStyle;
  eyebrow: TextStyle;
  screenTitle: TextStyle;
  statusLine: TextStyle;
  bandTitle: TextStyle;
  bandLabel: TextStyle;
  bandSub: TextStyle;
  heroValue: TextStyle;
  timerValue: TextStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  statSub: TextStyle;
  sectionHeader: TextStyle;
  ledgerTime: TextStyle;
  ledgerTitle: TextStyle;
  tag: TextStyle;
  tabLabel: TextStyle;
  chip: TextStyle;
};

/**
 * Type roles built from a palette (design README §Typography; letter-spacing is
 * the spec's em value × font size, in px). All mono labels are uppercase; data
 * values (times, numbers) stay untransformed. Colors are the role's resting
 * ink — rows/screens override for state (done/up, accent values, state colors).
 */
export function makeTypeRoles(c: Palette): TypeRoles {
  return {
    wordmark: {
      fontFamily: fonts.mono500,
      fontSize: 10,
      letterSpacing: 3.4,
      color: c.ink50,
      textTransform: "uppercase",
    },
    eyebrow: {
      fontFamily: fonts.mono500,
      fontSize: 9.5,
      letterSpacing: 2.28,
      color: c.ink50,
      textTransform: "uppercase",
    },
    screenTitle: {
      fontFamily: fonts.sans600,
      fontSize: 16,
      letterSpacing: -0.32,
      color: c.ink,
    },
    statusLine: {
      fontFamily: fonts.sans400,
      fontSize: 13,
      lineHeight: 19.5,
      color: c.ink64,
    },
    bandTitle: {
      fontFamily: fonts.sans700,
      fontSize: 21,
      letterSpacing: -0.52,
      color: c.ink,
    },
    bandLabel: {
      fontFamily: fonts.mono500,
      fontSize: 8.5,
      letterSpacing: 1.7,
      color: c.accent,
      textTransform: "uppercase",
    },
    bandSub: {
      fontFamily: fonts.mono500,
      fontSize: 9.5,
      letterSpacing: 0.95,
      color: c.ink50,
      textTransform: "uppercase",
    },
    heroValue: {
      fontFamily: fonts.mono600,
      fontSize: 30,
      letterSpacing: -0.9,
      color: c.ink,
      fontVariant: ["tabular-nums"],
    },
    timerValue: {
      fontFamily: fonts.mono600,
      fontSize: 34,
      letterSpacing: -1.02,
      color: c.ink,
      fontVariant: ["tabular-nums"],
    },
    statValue: {
      fontFamily: fonts.mono600,
      fontSize: 20,
      letterSpacing: -0.2,
      color: c.ink,
      fontVariant: ["tabular-nums"],
    },
    statLabel: {
      fontFamily: fonts.mono500,
      fontSize: 9,
      letterSpacing: 1.62,
      color: c.ink50,
      textTransform: "uppercase",
    },
    statSub: {
      fontFamily: fonts.mono500,
      fontSize: 8.5,
      color: c.ink50,
      textTransform: "uppercase",
    },
    sectionHeader: {
      fontFamily: fonts.mono600,
      fontSize: 10.5,
      letterSpacing: 2.73,
      color: c.ink72,
      textTransform: "uppercase",
    },
    ledgerTime: {
      fontFamily: fonts.mono400,
      fontSize: 11,
      color: c.ink50,
      fontVariant: ["tabular-nums"],
    },
    ledgerTitle: {
      fontFamily: fonts.sans500,
      fontSize: 14,
      color: c.ink,
    },
    tag: {
      fontFamily: fonts.mono500,
      fontSize: 8.5,
      letterSpacing: 1.02,
      color: c.ink34,
      textTransform: "uppercase",
    },
    tabLabel: {
      fontFamily: fonts.mono500,
      fontSize: 7.5,
      letterSpacing: 1.2,
      color: c.tabInactive,
      textTransform: "uppercase",
    },
    chip: {
      fontFamily: fonts.sans500,
      fontSize: 11.5,
      color: c.ink,
    },
  };
}
