import Svg, { Path } from "react-native-svg";

/**
 * Capture-local line icons (spec §1 rule 4: 1.7px stroke, round caps/joins).
 * Defined here — not in the shared icons.tsx — because parallel agents own that
 * file. The shared set already covers mic / send / lock / check / close / undo /
 * chevron; only the pencil (Edit chip) is missing, so it lives here.
 */
type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

/** Pencil — the "Edit" footer chip on a confirmation card. */
export function EditIcon({ size = 11, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L19 9l-4-4L4 16z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
