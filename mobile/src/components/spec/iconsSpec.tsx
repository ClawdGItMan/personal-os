import type { ReactNode } from "react";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Spec-sheet line icons (design README §Assets): ~20pt, stroke 1.5, round
 * caps/joins. Tab glyphs = home / body silhouette / dollar / desk lamp (focus)
 * / plus (capture); spark is the filled assistant glyph.
 */
type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

const defaults = { size: 20, strokeWidth: 1.5 };

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function IconHome({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M3.5 10.5 12 4l8.5 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.5 9.5V20h13V9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IconBody({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={5} r={2.1} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 7.5v5.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.5 10.5 12 9l4.5 1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 13l-2.6 7M12 13l2.6 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IconDollar({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 3v18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M16.2 7.3c-.8-1.5-2.3-2.3-4.2-2.3-2.2 0-3.9 1.2-3.9 3 0 4.1 8 2 8 6.3 0 2-1.8 3.2-4.1 3.2-2.1 0-3.7-1-4.4-2.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function IconLamp({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="m14 5-3 3 2 7 8-8-7-2Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m14 5-3 3-3-3 3-3 3 3Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 6.5 4 12l3 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H3Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IconPlus({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 5.5v13M5.5 12h13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Frame>
  );
}

/** Four-point spark + satellite dot — the assistant glyph (filled, not stroked). */
export function IconSpark({ size = defaults.size, color }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 3.5c.7 4.2 2.8 6.3 7 7-4.2.7-6.3 2.8-7 7-.7-4.2-2.8-6.3-7-7 4.2-.7 6.3-2.8 7-7Z" fill={color} />
      <Circle cx={19.4} cy={4.6} r={1.2} fill={color} opacity={0.5} />
    </Frame>
  );
}
