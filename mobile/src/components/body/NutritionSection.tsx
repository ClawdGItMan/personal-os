import { StyleSheet, Text, View } from "react-native";

import { bodyData, type Macro } from "../../data/body";
import { color, font, type } from "../../theme/tokens";
import { ProgressBar } from "../ProgressBar";
import { SectionHeader } from "../SectionHeader";
import { GradientRing } from "./GradientRing";

const KCAL_RING = 74;

/** Distinct token color per macro (spec §5.2: protein/carbs/fat). */
const MACRO_TONE: Record<Macro["tone"], string> = {
  green: color.green,
  blue: color.blue,
  yellow: color.yellow,
};

/**
 * Nutrition (spec §5.2): a calorie ring (blue→green sweep = % of target) beside
 * protein / carbs / fat macro bars, each in its own token color.
 */
export function NutritionSection() {
  const { nutrition } = bodyData;
  return (
    <View>
      <SectionHeader title="Nutrition" meta={nutrition.meta} />

      <View style={styles.row}>
        <GradientRing pct={nutrition.kcalPct} size={KCAL_RING} thickness={8} gradient={[color.blue, color.green]}>
          <Text style={styles.ringValue}>
            {nutrition.kcalLabel}
            <Text style={styles.ringPct}>%</Text>
          </Text>
        </GradientRing>

        <View style={styles.macros}>
          {nutrition.macros.map((macro) => (
            <View key={macro.label} style={styles.macro}>
              <View style={styles.macroHead}>
                <Text style={type.microLabel}>{macro.label}</Text>
                <Text style={styles.macroGrams}>{macro.grams}</Text>
              </View>
              <ProgressBar pct={macro.pct} fill={MACRO_TONE[macro.tone]} height={6} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  ringValue: {
    fontFamily: font.monoSemi,
    fontSize: 15,
    color: color.fg1,
    fontVariant: ["tabular-nums"],
  },
  ringPct: {
    fontSize: 8,
    color: color.fg3,
  },
  macros: {
    flex: 1,
    gap: 11,
  },
  macro: {
    gap: 5,
  },
  macroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroGrams: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.fg2,
    fontVariant: ["tabular-nums"],
  },
});
