import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * Crafted line icons — 1.7px stroke, round caps/joins (spec §1 rule 4).
 * Paths are the approved mockup glyphs. No emoji, ever.
 */
type IconProps = {
  size?: number;
  color: string;
  strokeWidth?: number;
};

const defaults = { size: 21, strokeWidth: 1.7 };

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function HomeIcon({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M3 10.5 12 4l9 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 9.5V20h5v-6h4v6h5V9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function BodyIcon({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M3 12h4l2-6 4 12 2-6h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function PlusIcon({ size = defaults.size, color, strokeWidth = 2.2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Frame>
  );
}

export function MoneyIcon({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Rect x={2.5} y={6.5} width={19} height={11} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={12} r={2.3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M6 10v4M18 10v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Frame>
  );
}

export function FocusIcon({ size = defaults.size, color, strokeWidth = defaults.strokeWidth }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9 12l2 2 4-4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Right chevron — row tap affordance + detail back-arrow (mirror with rotation). */
export function ChevronIcon({ size = 15, color, strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Checkmark — completed task checkbox glyph. */
export function CheckIcon({ size = 11, color, strokeWidth = 2.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Spark / asterisk — the AI-recommendation glyph (agent reaching in). */
export function SparkIcon({ size = 15, color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** Padlock — permission gate (needs access). */
export function LockIcon({ size = 13, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Microphone — voice / dictation capture input. */
export function MicIcon({ size = 18, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Send — paper-plane arrow, Capture dock. */
export function SendIcon({ size = 18, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Undo — counter-clockwise arrow, confirmation card. */
export function UndoIcon({ size = 13, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M5 8h8a5 5 0 0 1 0 10H8M5 8l3-3M5 8l3 3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** Close — X, sheet/overlay dismiss. */
export function CloseIcon({ size = 18, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Frame>
  );
}
