import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { BandMessage } from "../components/body/BandMessage";
import { SleepBand } from "../components/body/SleepBand";
import { TrainingBand, TrainingEmptyBand } from "../components/body/TrainingBand";
import { useBodyHistory } from "../components/body/useBodyHistory";
import { WeekCells } from "../components/body/WeekCells";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { HrvBars } from "../components/spec/HrvBars";
import { RecoveryDial } from "../components/spec/RecoveryDial";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { Skeleton } from "../components/spec/Skeleton";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import {
  buildWeekDays,
  countWeekSessions,
  daysSinceMonday,
  formatTrainingSub,
  hrvMock,
  isoWeek,
  recoveryFallback,
  restHRMock,
  titleCaseSport,
} from "../data/body";
import { eyebrowDate, time12 } from "../lib/format";
import { useHealthToday, useSleepDetail, useWorkouts } from "../lib/queries";
import type { LatestWorkout } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import type { DetailItem } from "../navigation/NavContext";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";

/** A workout older than this doesn't count as "this week's" training. */
const WORKOUT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Maps `useWorkouts`' camelCased `LatestWorkout` projection back to the raw
 * `workouts` table column names DetailScreen's `workoutFacts()` reads
 * (DetailItem is `[key: string]: unknown`, so this mismatch isn't caught by
 * tsc — see NavContext.DetailItem). Keep in sync with `workoutFacts()`.
 */
function toWorkoutDetailItem(w: LatestWorkout): DetailItem {
  return {
    kind: "workout",
    title: titleCaseSport(w.sport),
    sport: w.sport,
    source: w.source,
    started_at: w.startedAt,
    duration_sec: w.durationSec,
    avg_hr: w.avgHr,
    max_hr: w.maxHr,
    strain: w.strain,
    distance_m: w.distanceM,
    energy_kj: w.energyKj,
  };
}

/**
 * Body (design README §Body, spec 7a) — recovery dial, today's training,
 * last night's sleep, vitals, and this week's sessions. Recovery score, HRV,
 * rest HR are live via `useHealthToday` (HRV/REST HR 7-day deltas still have
 * no trend provider, see `src/data/body.ts`'s `hrvMock`/`restHRMock`);
 * training + the week grid are live via `useWorkouts`; sleep is live via
 * `useSleepDetail`; weight + sleep debt are live via the colocated
 * `useBodyHistory`.
 */
export function BodyScreen() {
  const { c, t } = useTheme();
  const { data: health } = useHealthToday();
  const sleep = useSleepDetail();
  const bodyHistory = useBodyHistory();
  const { openDetail } = useNav();

  const now = new Date();
  const workouts = useWorkouts(daysSinceMonday(now) + 1); // Monday…today, oldest first

  const recoveryScore = health?.recoveryScore ?? recoveryFallback.score;
  const hrv = health?.hrv != null ? Math.round(health.hrv) : hrvMock.fallback;
  const rhr = health?.rhr != null ? Math.round(health.rhr) : restHRMock.fallback;

  const weightValue = bodyHistory.loading
    ? "···"
    : bodyHistory.weightLatest != null
      ? bodyHistory.weightLatest.toFixed(1)
      : "—";
  const weightSub = bodyHistory.loading
    ? ""
    : bodyHistory.error
      ? "COULDN'T LOAD"
      : bodyHistory.weightDeltaLb != null
        ? `${bodyHistory.weightDeltaLb > 0 ? "+" : bodyHistory.weightDeltaLb < 0 ? "−" : "±"}${Math.abs(bodyHistory.weightDeltaLb).toFixed(1)} · 30D`
        : bodyHistory.weightLatest != null
          ? "NO 30D DATA"
          : "NO DATA";

  const statItems: StatItem[] = [
    { label: "REST HR", value: String(rhr), sub: restHRMock.delta },
    { label: "HRV", value: String(hrv), sub: hrvMock.delta, subColor: c.accent },
    { label: "WEIGHT", value: weightValue, sub: weightSub },
  ];

  const isStaleOrMissingWorkout =
    !workouts.latest || Date.now() - new Date(workouts.latest.startedAt).getTime() > WORKOUT_STALE_MS;

  const weekDays = buildWeekDays(workouts.week);
  const weekSessions = countWeekSessions(workouts.week);

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

      {workouts.loading ? (
        <Band variant="plain" index={2}>
          <Text style={t.sectionHeader}>TRAINING</Text>
          <View style={styles.skeletonTitle}>
            <Skeleton width="70%" height={21} radius={4} />
          </View>
          <View style={styles.skeletonSub}>
            <Skeleton width="50%" height={12} radius={4} />
          </View>
        </Band>
      ) : workouts.error ? (
        <Band variant="plain" index={2}>
          <Text style={t.sectionHeader}>TRAINING</Text>
          <BandMessage kind="error" onRetry={workouts.refetch} />
        </Band>
      ) : isStaleOrMissingWorkout ? (
        <TrainingEmptyBand index={2} />
      ) : (
        <TrainingBand
          time={time12(workouts.latest!.startedAt)}
          title={titleCaseSport(workouts.latest!.sport)}
          sub={formatTrainingSub(workouts.latest!)}
          onPress={() => openDetail(toWorkoutDetailItem(workouts.latest!))}
          index={2}
        />
      )}

      <SleepBand sleep={sleep} sleepDebtMin={bodyHistory.sleepDebtMin} index={3} />

      <StatGrid items={statItems} index={4} />

      {workouts.loading ? (
        <Band variant="plain" index={5}>
          <Text style={t.sectionHeader}>THIS WEEK</Text>
          <View style={styles.skeletonWeek}>
            <Skeleton width="100%" height={22} radius={4} />
          </View>
        </Band>
      ) : workouts.error ? (
        <Band variant="plain" index={5}>
          <Text style={t.sectionHeader}>THIS WEEK</Text>
          <BandMessage kind="error" onRetry={workouts.refetch} />
        </Band>
      ) : (
        <Band variant="plain" index={5}>
          <WeekCells sessions={weekSessions} days={weekDays} />
        </Band>
      )}
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
  recoveryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  skeletonTitle: {
    marginTop: 10,
  },
  skeletonSub: {
    marginTop: 8,
  },
  skeletonWeek: {
    marginTop: 14,
  },
});
