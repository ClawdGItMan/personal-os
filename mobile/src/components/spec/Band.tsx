import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

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
          // Flat rgba fill, not an SVG gradient: react-native-svg drops the
          // alpha from rgba() gradient stops on iOS, painting the wash as solid
          // accent green. A plain View honors the alpha and fills full-bleed.
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bandWash }]} />
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
