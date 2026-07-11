import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../../theme/ThemeContext";

/**
 * The sheet's localized agent-identity top-glow (spec §2.2): a single accent
 * radial bloom at the top edge — radial-gradient(120% 36% at 50% 0%, accent
 * @10%, transparent 64%). Sits behind sheet content.
 */
export function SheetGlow() {
  const { c } = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="sheetGlow" cx="50%" cy="0%" rx="120%" ry="36%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={c.accent} stopOpacity={0.1} />
          <Stop offset="0.64" stopColor={c.accent} stopOpacity={0} />
          <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sheetGlow)" />
    </Svg>
  );
}
