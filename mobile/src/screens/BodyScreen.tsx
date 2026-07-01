import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { SectionEnter } from "../components/SectionEnter";
import { NutritionSection } from "../components/body/NutritionSection";
import { RecoverySection } from "../components/body/RecoverySection";
import { SleepSection } from "../components/body/SleepSection";
import { StrainSection } from "../components/body/StrainSection";
import { TrainingSection } from "../components/body/TrainingSection";
import { applyLiveBody, bodyData } from "../data/body";
import { useHealthToday } from "../lib/queries";
import { color, font, space, type } from "../theme/tokens";

/**
 * Body (spec §5.2) — the health read: recovery → sleep → strain → training →
 * nutrition, opened by a serif "read" of state ("Well recovered."). Content
 * only; the shared AmbientBackground + BottomNav are owned by the App shell.
 */
export function BodyScreen() {
  // Merge live Whoop metrics over the mock in place; null/loading keeps the mock.
  // The hook's state change re-renders this screen and its sections, which read
  // the (now-merged) `bodyData.*` in their render bodies.
  const { data: health } = useHealthToday();
  if (health) {
    applyLiveBody({
      recoveryScore: health.recoveryScore,
      hrv: health.hrv,
      rhr: health.rhr,
      sleepHours: health.sleepHours,
      sleepScore: health.sleepScore,
      strain: health.strain,
    });
  }

  const { eyebrow, title } = bodyData;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader recoveryPct={bodyData.recoveryPct} tone={color.green} />

      <SectionEnter index={0}>
        <View style={styles.titleBlock}>
          <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
          <Text style={type.screenTitle}>
            {title.lead}
            <Text style={styles.emphasis}>{title.emphasis}</Text>
          </Text>
        </View>
      </SectionEnter>

      <SectionEnter index={1}>
        <RecoverySection />
      </SectionEnter>
      <SectionEnter index={2}>
        <SleepSection />
      </SectionEnter>
      <SectionEnter index={3}>
        <StrainSection />
      </SectionEnter>
      <SectionEnter index={4}>
        <TrainingSection />
      </SectionEnter>
      <SectionEnter index={5}>
        <NutritionSection />
      </SectionEnter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  titleBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  eyebrow: {
    marginBottom: 10,
  },
  emphasis: {
    fontFamily: font.serifItalic,
  },
});
