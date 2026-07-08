import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { FadeUp } from "../../motion/FadeUp";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";

export type BandVariant = "plain" | "accent" | "recovery";

type BandProps = {
  /** "plain" = ink hairlines · "accent" = accent borders + gradient wash (live/focus bands) · "recovery" = softer accent-tint borders, no wash. */
  variant: BandVariant;
  children: ReactNode;
  /** FadeUp stagger slot for the load choreography. */
  index?: number;
};

/**
 * Full-bleed hairline-ruled band — the core spec-sheet section (design README
 * §Spacing & structure: borders span edge to edge, content padded 24, ~17pt
 * vertical). No cards anywhere in the system.
 */
export function Band({ variant, children, index = 0 }: BandProps) {
  const { c } = useTheme();
  const borderColor =
    variant === "accent" ? c.bandBorder : variant === "recovery" ? c.bandBorderRecovery : c.hairSection;

  return (
    <FadeUp index={index}>
      <View style={[styles.band, { borderColor }]}>
        {variant === "accent" ? (
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" width="100%" height="100%">
            <Defs>
              <LinearGradient id="bandWash" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.bandGrad0} />
                <Stop offset="1" stopColor={c.bandGrad1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#bandWash)" />
          </Svg>
        ) : null}
        {children}
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  band: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: layout.bandPadV,
    paddingHorizontal: layout.gutter,
    overflow: "hidden",
  },
});
