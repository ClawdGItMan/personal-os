import { Platform, ScrollView, StyleSheet } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { GreetingBlock } from "../components/GreetingBlock";
import { SectionEnter } from "../components/SectionEnter";
import { SectionHeader } from "../components/SectionHeader";
import { TimelineRow } from "../components/TimelineRow";
import { VitalsStrip } from "../components/VitalsStrip";
import { applyLiveHome, homeData } from "../data/home";
import { useHealthToday, useHomeHabits } from "../lib/queries";
import { space } from "../theme/tokens";

/**
 * Home (spec §5.1) — the curated glance: greeting → vitals strip → TODAY
 * timeline. Capture lives in the ⊕ only; Focus owns the full working surface.
 * The shared AmbientBackground + BottomNav are owned by App (the nav shell).
 */
export function HomeScreen() {
  // Merge live Whoop recovery/sleep + the real habit tally over the mock in
  // place; net worth stays mock. Either hook resolving re-renders this screen
  // and VitalsStrip, which reads the merged `homeData.vitals.*` on render.
  const { data: health } = useHealthToday();
  const { data: habits } = useHomeHabits();
  if (health || habits) {
    applyLiveHome({
      recoveryScore: health?.recoveryScore ?? null,
      hrv: health?.hrv ?? null,
      sleepHours: health?.sleepHours ?? null,
      sleepScore: health?.sleepScore ?? null,
      habits: habits ?? null,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader recoveryPct={homeData.recoveryPct} />
      <SectionEnter index={0}>
        <GreetingBlock
          eyebrow={homeData.eyebrow}
          lead={homeData.greeting.lead}
          name={homeData.greeting.name}
          whisper={homeData.whisper}
          dayProgress={homeData.dayProgress}
        />
      </SectionEnter>
      <SectionEnter index={1}>
        <VitalsStrip />
      </SectionEnter>
      <SectionEnter index={2}>
        <SectionHeader title="Today" meta={homeData.today.meta} />
        {homeData.timeline.map((item) => (
          <TimelineRow key={`${item.time}-${item.title}`} item={item} />
        ))}
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
});
