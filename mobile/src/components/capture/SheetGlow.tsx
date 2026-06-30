import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The sheet's localized agent-identity top-glow (spec §2.2): a single blue
 * radial bloom at the top edge —
 * radial-gradient(120% 36% at 50% 0%, rgba(79,157,224,.10), transparent 64%).
 * Mirrors AmbientBackground's SVG approach (raw brand blue, since gradient stops
 * need an explicit hex, not the surface token). Sits behind sheet content.
 */
const BLUE = "#4F9DE0";

export function SheetGlow() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="sheetGlow" cx="50%" cy="0%" rx="120%" ry="36%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={BLUE} stopOpacity={0.1} />
          <Stop offset="0.64" stopColor={BLUE} stopOpacity={0} />
          <Stop offset="1" stopColor={BLUE} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sheetGlow)" />
    </Svg>
  );
}
