import Svg, { Path } from "react-native-svg";

/**
 * Detail-only line icons (spec rule 4: 1.7px stroke, round caps/joins, no
 * emoji). Defined locally so the shared icons.tsx stays untouched while
 * parallel screen agents edit it. The shared ChevronIcon points right; the
 * Detail back header needs a left-pointing chevron, hence this local glyph.
 */
type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

/** Back chevron — points left, leads the "‹ FOCUS" header (mockup `.dt-back`). */
export function BackChevronIcon({ size = 15, color, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
