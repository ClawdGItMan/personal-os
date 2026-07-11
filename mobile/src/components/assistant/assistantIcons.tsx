import type { ReactNode } from "react";
import Svg, { Path } from "react-native-svg";

/**
 * Assistant-sheet-only glyphs — close (header) and send (ask bar). Follows
 * the same Frame/viewBox-24 convention as components/spec/iconsSpec.tsx, kept
 * local here since this wave's owner may not touch that shared file.
 */
type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

/** Close — X, sheet dismiss (header close circle). */
export function IconClose({ size = 14, color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Frame>
  );
}

/** Send — up arrow, ask-bar submit circle. */
export function IconSend({ size = 15, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M12 19V6M6 11l6-6 6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}
