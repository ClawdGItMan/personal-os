import Svg, { Path } from "react-native-svg";

/**
 * Money-local delta glyphs — small filled triangles for the ▲ / ▼ deltas.
 * Defined here (not in shared icons.tsx) to avoid touching a file parallel
 * agents also own. Color is always passed by the caller (green ▲, muted ▼).
 */
type TriProps = {
  size?: number;
  color: string;
};

/** Up triangle — net-worth gain marker. Always GREEN at the call site. */
export function TriUp({ size = 8, color }: TriProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <Path d="M5 1.5 9 8.5H1Z" fill={color} />
    </Svg>
  );
}

/** Down triangle — calm muted decline marker (never red — spec down-is-muted). */
export function TriDown({ size = 8, color }: TriProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <Path d="M5 8.5 1 1.5h8Z" fill={color} />
    </Svg>
  );
}
