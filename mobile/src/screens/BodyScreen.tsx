import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { SleepStageBar } from "../components/body/SleepStageBar";
import { TrainingBand } from "../components/body/TrainingBand";
import { WeekCells } from "../components/body/WeekCells";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { HrvBars } from "../components/spec/HrvBars";
import { RecoveryDial } from "../components/spec/RecoveryDial";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import {
  formatSleepHero,
  hrvMock,
  isoWeek,
  recoveryFallback,
  restHRMock,
  sleepColor,
  sleepMock,
  trainingMock,
  weekMock,
  weightMock,
} from "../data/body";
import { eyebrowDate } from "../lib/format";
import { useHealthToday } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import { useTheme } from "../theme/ThemeContext";

/**
 * Body (design README §Body, spec 7a) — recovery dial, today's training,
 * last night's sleep, vitals, and this week's sessions. Recovery score, HRV,
 * rest HR, sleep hours + quality are live via `useHealthToday`; everything
 * else (training, sleep stages/window, weight, week grid) is mock — see
 * `src/data/body.ts`.
 */
export function BodyScreen() {
  const { c, t } = useTheme();
  const { data: health } = useHealthToday();

  const recoveryScore = health?.recoveryScore ?? recoveryFallback.score;
  const hrv = health?.hrv != null ? Math.round(health.hrv) : hrvMock.fallback;
  const rhr = health?.rhr != null ? Math.round(health.rhr) : restHRMock.fallback;
  const sleepHours = health?.sleepHours ?? sleepMock.hoursFallback;
  const sleepQuality = health?.sleepScore != null ? Math.round(health.sleepScore) : sleepMock.qualityFallback;

  const now = new Date();

  const statItems: StatItem[] = [
    { label: "REST HR", value: String(rhr), sub: restHRMock.delta },
    { label: "HRV", value: String(hrv), sub: hrvMock.delta, subColor: c.accent },
    { label: "WEIGHT", value: weightMock.value, sub: weightMock.delta },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader />

      <FadeUp index={0}>
        <View style={styles.eyebrowSpace}>
          <Eyebrow left={eyebrowDate(now)} right={`WEEK ${isoWeek(now)}`} />
        </View>
        <View style={styles.titleSpace}>
          <TitleBlock
            title="Body"
            status={["Recovery's ", { b: "green" }, " — cleared for the push day, logged this morning."]}
          />
        </View>
      </FadeUp>

      <View style={styles.firstBand}>
        <Band variant="recovery" index={1}>
          <Text style={t.sectionHeader}>RECOVERY</Text>
          <View style={styles.recoveryRow}>
            <RecoveryDial score={recoveryScore} />
            <HrvBars label="HRV · 7D" sub={`${hrv} MS · REST ${rhr}`} />
          </View>
        </Band>
      </View>

      <TrainingBand time={trainingMock.time} title={trainingMock.title} sub={trainingMock.sub} index={2} />

      <Band variant="plain" index={3}>
        <View style={styles.rowBetween}>
          <Text style={t.sectionHeader}>SLEEP · LAST NIGHT</Text>
          <Text style={t.ledgerTime}>{sleepMock.window}</Text>
        </View>
        <View style={styles.sleepHeroRow}>
          <Text style={[t.heroValue, { color: sleepColor(c, sleepHours) }]}>{formatSleepHero(sleepHours)}</Text>
          <Text style={t.bandSub}>{sleepQuality}% QUALITY</Text>
        </View>
        <SleepStageBar stages={sleepMock.stages} />
      </Band>

      <StatGrid items={statItems} index={4} />

      <Band variant="plain" index={5}>
        <WeekCells sessions={weekMock.sessions} days={weekMock.days} />
      </Band>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  eyebrowSpace: {
    marginTop: 26,
  },
  titleSpace: {
    marginTop: 20,
  },
  firstBand: {
    marginTop: 22,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sleepHeroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 12,
  },
});
