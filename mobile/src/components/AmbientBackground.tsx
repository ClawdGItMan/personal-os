import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { color } from "../theme/tokens";

const BLUE = "#4F9DE0";

type GlowProps = {
  id: string;
  cy: string;
  rx: string;
  ry: string;
  alpha: number;
  fade: number;
};

function Glow({ id, cy, rx, ry, alpha, fade }: GlowProps) {
  return (
    <RadialGradient id={id} cx="50%" cy={cy} rx={rx} ry={ry} gradientUnits="objectBoundingBox">
      <Stop offset="0" stopColor={BLUE} stopOpacity={alpha} />
      <Stop offset={String(fade)} stopColor={BLUE} stopOpacity={0} />
      <Stop offset="1" stopColor={BLUE} stopOpacity={0} />
    </RadialGradient>
  );
}

/**
 * The fixed atmospheric depth layer (spec §2.2): three stacked blue radials
 * over the warm-dark base. Sits behind every screen and does NOT scroll —
 * content scrolls above it. The top glow breathes (ambient loop, later pass).
 */
export function AmbientBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Glow id="ambTop" cy="0%" rx="110%" ry="38%" alpha={0.13} fade={0.62} />
        <Glow id="ambMid" cy="46%" rx="130%" ry="46%" alpha={0.085} fade={0.68} />
        <Glow id="ambBot" cy="92%" rx="130%" ry="42%" alpha={0.06} fade={0.7} />
      </Defs>
      <Rect width="100%" height="100%" fill={color.bg} />
      <Rect width="100%" height="100%" fill="url(#ambTop)" />
      <Rect width="100%" height="100%" fill="url(#ambMid)" />
      <Rect width="100%" height="100%" fill="url(#ambBot)" />
    </Svg>
  );
}
