/**
 * Locked design-system palettes — system-tokens.md (LIGHT = 6b "Gallery/Porcelain",
 * DARK = 6c "Ivy"). Every color in the new screens comes from here via useTheme();
 * nothing below is decorative — each key maps to a named surface/role in the spec.
 */
export type Mode = "light" | "dark";

export type Palette = {
  bg: string;
  surface: string;
  sheet: string;
  ink: string;
  ink72: string;
  ink64: string;
  ink50: string;
  ink38: string;
  ink34: string;
  ink28: string;
  hairSection: string;
  hairCol: string;
  hairRow: string;
  accent: string;
  accentDeep: string;
  amber: string;
  amberPip: string;
  red: string;
  bandBorder: string;
  bandBorderRecovery: string;
  bandGrad0: string;
  bandGrad1: string;
  dialTrack: string;
  hrvBar: string;
  pipTrack: string;
  dayFill: string;
  dayTrack: string;
  tabInactive: string;
  captureBg: string;
  captureRing: string;
  indicator: string;
  scrim: string;
  shimmer: string;
  onAccent: string;
};

/** LIGHT — porcelain bg, white surfaces, evergreen accent (system-tokens.md §LIGHT). */
export const light: Palette = {
  bg: "#F5F3ED",
  surface: "#FFFFFF",
  sheet: "#F5F3ED",
  ink: "#0F1115",
  ink72: "rgba(15,17,21,0.72)",
  ink64: "rgba(15,17,21,0.64)",
  ink50: "rgba(15,17,21,0.5)",
  ink38: "rgba(15,17,21,0.38)",
  ink34: "rgba(15,17,21,0.34)",
  ink28: "rgba(15,17,21,0.28)",
  hairSection: "rgba(15,17,21,0.1)",
  hairCol: "rgba(15,17,21,0.07)",
  hairRow: "rgba(15,17,21,0.06)",
  accent: "#1E7A52",
  accentDeep: "#175E40",
  amber: "#A8842B",
  amberPip: "#B9973E",
  red: "#B0472F",
  bandBorder: "rgba(30,122,82,0.28)",
  bandBorderRecovery: "rgba(30,122,82,0.24)",
  bandGrad0: "rgba(30,122,82,0.055)",
  bandGrad1: "rgba(30,122,82,0.02)",
  dialTrack: "rgba(15,17,21,0.08)",
  hrvBar: "rgba(30,122,82,0.35)",
  pipTrack: "rgba(15,17,21,0.1)",
  dayFill: "rgba(15,17,21,0.38)",
  dayTrack: "rgba(15,17,21,0.08)",
  tabInactive: "rgba(15,17,21,0.38)",
  captureBg: "#FFFFFF",
  captureRing: "rgba(15,17,21,0.12)",
  indicator: "rgba(15,17,21,0.28)",
  scrim: "rgba(15,17,21,0.38)",
  shimmer: "rgba(255,255,255,0.65)",
  onAccent: "#F5F3ED",
};

/** DARK — green-cast near-black, bone ink, ivy accent (system-tokens.md §DARK). */
export const dark: Palette = {
  bg: "#0C0F0C",
  surface: "#141813",
  sheet: "#0F120F",
  ink: "#EFEDE2",
  ink72: "rgba(239,237,226,0.72)",
  ink64: "rgba(239,237,226,0.66)",
  ink50: "rgba(239,237,226,0.5)",
  ink38: "rgba(239,237,226,0.4)",
  ink34: "rgba(239,237,226,0.34)",
  ink28: "rgba(239,237,226,0.28)",
  hairSection: "rgba(239,237,226,0.12)",
  hairCol: "rgba(239,237,226,0.08)",
  hairRow: "rgba(239,237,226,0.07)",
  accent: "#6CAB86",
  accentDeep: "#3A6B51",
  amber: "#C9A45C",
  amberPip: "#C9A45C", // dark spec defines a single amber — pips share it
  red: "#C86A5A",
  bandBorder: "rgba(108,171,134,0.28)",
  bandBorderRecovery: "rgba(108,171,134,0.24)",
  bandGrad0: "rgba(108,171,134,0.06)",
  bandGrad1: "rgba(108,171,134,0.025)",
  dialTrack: "rgba(239,237,226,0.09)",
  hrvBar: "rgba(108,171,134,0.36)",
  pipTrack: "rgba(239,237,226,0.13)",
  dayFill: "rgba(239,237,226,0.45)",
  dayTrack: "rgba(239,237,226,0.1)",
  tabInactive: "rgba(239,237,226,0.34)",
  captureBg: "#141813",
  captureRing: "rgba(239,237,226,0.16)",
  indicator: "rgba(239,237,226,0.28)",
  scrim: "rgba(0,0,0,0.55)",
  shimmer: "rgba(239,237,226,0.5)",
  onAccent: "#0C0F0C",
};
