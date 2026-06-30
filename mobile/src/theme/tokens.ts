import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Design tokens — 1:1 with the approved mobile design spec §2
 * (docs/superpowers/specs/2026-06-09-personal-os-mobile-design.md).
 * Color is meaning, never decoration. No red anywhere in the system.
 */
export const color = {
  bg: "#0E1014",
  surface: "#14171C",
  sheet: "#12151A",
  fg1: "#F2EEE6",
  fg2: "rgba(242,238,230,0.72)",
  fg3: "rgba(242,238,230,0.52)",
  fg4: "rgba(242,238,230,0.36)",
  line1: "rgba(242,238,230,0.07)",
  line2: "rgba(242,238,230,0.12)",
  blue: "#3A70A8",
  green: "#2F6647",
  yellow: "#F1DA85",
} as const;

export const space = {
  xs2: 3,
  xs: 7,
  sm: 9,
  md: 14,
  gutter: 22,
  lg: 26,
  xl: 30,
} as const;

export const radius = {
  sheet: 28,
  card: 14,
  field: 16,
  pill: 10,
  chip: 8,
  full: 999,
} as const;

/**
 * Three-voice system (Max-approved): Instrument Serif = the one expressive
 * display moment (greeting), Hanken Grotesk = quiet clean UI text,
 * Geist Mono = precise labels & data.
 */
export const font = {
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
  mono: "GeistMono_400Regular",
  monoSemi: "GeistMono_500Medium",
  monoBold: "GeistMono_600SemiBold",
  sans: "HankenGrotesk_500Medium",
  sansSemi: "HankenGrotesk_600SemiBold",
} as const;

/** Soft outer glow — RN shadow props (react-native-web maps these to box-shadow). */
export function glow(glowColor: string, glowRadius: number, opacity: number): ViewStyle {
  return {
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: glowRadius,
    shadowOpacity: opacity,
    ...(Platform.OS === "android" ? { elevation: 4 } : null),
  };
}

/** Type roles — spec §2.3. Mono numbers rely on JetBrains Mono being monospaced. */
export const type: Record<string, TextStyle> = {
  eyebrow: {
    fontFamily: font.monoBold,
    fontSize: 9,
    letterSpacing: 1.0,
    color: color.fg3,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: font.monoBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: color.fg2,
    textTransform: "uppercase",
  },
  sectionMeta: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.7,
    color: color.fg3,
    textTransform: "uppercase",
  },
  microLabel: {
    fontFamily: font.monoSemi,
    fontSize: 8,
    letterSpacing: 0.9,
    color: color.fg3,
    textTransform: "uppercase",
  },
  time: {
    fontFamily: font.monoSemi,
    fontSize: 10,
    color: color.fg4,
  },
  valueM: {
    fontFamily: font.monoSemi,
    fontSize: 21,
    lineHeight: 22,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
  },
  navLabel: {
    fontFamily: font.monoSemi,
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: color.fg4,
    textTransform: "uppercase",
  },
  rowTitle: {
    fontFamily: font.sansSemi,
    fontSize: 15,
    letterSpacing: -0.15,
    color: color.fg1,
  },
  rowSub: {
    fontFamily: font.monoSemi,
    fontSize: 9,
    letterSpacing: 0.6,
    color: color.fg4,
    textTransform: "uppercase",
    marginTop: 3,
  },
  greeting: {
    fontFamily: font.serif,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.34,
    color: color.fg1,
  },
  whisper: {
    fontFamily: "HankenGrotesk_400Regular",
    fontSize: 13.5,
    lineHeight: 20,
    color: color.fg3,
  },
  brand: {
    fontFamily: font.monoSemi,
    fontSize: 11,
    letterSpacing: 1.54,
    color: color.fg2,
  },
  /** Screen title — the serif "read" of state (e.g. "Well recovered."). Spec §5. */
  screenTitle: {
    fontFamily: font.serif,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: color.fg1,
  },
  /** Italic emphasis span inside a screen title (e.g. the *left.* in "Two deep blocks left."). */
  screenTitleItalic: {
    fontFamily: font.serifItalic,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: color.fg1,
  },
  /** Hero metric — Money net worth. Mono, tabular, large. */
  valueXL: {
    fontFamily: font.monoSemi,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.4,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
  },
  /** Large metric — sleep duration, ring center. */
  valueL: {
    fontFamily: font.monoSemi,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.32,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
  },
  /** Serif-italic body read-out (e.g. "Green to push…" under the recovery ring). */
  serifReadout: {
    fontFamily: font.serifItalic,
    fontSize: 15,
    lineHeight: 22,
    color: color.fg2,
  },
};
