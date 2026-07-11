import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { Band } from "../components/spec/Band";
import { DayBar } from "../components/spec/DayBar";
import { Eyebrow } from "../components/spec/Eyebrow";
import { HrvBars } from "../components/spec/HrvBars";
import { LedgerRow } from "../components/spec/LedgerRow";
import { RecoveryDial } from "../components/spec/RecoveryDial";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import { dayProgressPct, greetingLead, homeData, splitHours } from "../data/home";
import { eyebrowDate } from "../lib/format";
import { useHealthToday, useHomeHabits } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import { Shimmer } from "../motion/Shimmer";
import { useFillAnim } from "../motion/useFillAnim";
import { layout } from "../theme/layout";
import { useTheme } from "../theme/ThemeContext";

/**
 * Home (design README §Home, spec 6b/6c) — eyebrow/day-bar, greeting, the
 * live FOCUS band, RECOVERY band, 3-col vitals, and the TODAY ledger. Capture
 * lives in the tab bar's ⊕; the Assistant sheet lives behind the spark button
 * in ScreenHeader. TabBar is rendered by the shell (App.tsx).
 */
export function HomeScreen() {
  const { mode, c, t } = useTheme();

  // Merge live Whoop recovery/HRV/sleep + the real habit tally over the mock
  // fallback into locals (Body's pattern — no module-state mutation in
  // render). Net worth and the TODAY ledger stay mock (no provider yet).
  const { data: health } = useHealthToday();
  const { data: habits } = useHomeHabits();

  const recoveryScore = health?.recoveryScore != null ? Math.round(health.recoveryScore) : homeData.recovery.score;
  const hrv = health?.hrv != null ? Math.round(health.hrv) : homeData.hrv.ms;
  const restHr = health?.rhr != null ? Math.round(health.rhr) : homeData.hrv.restHr;
  const sleep = health?.sleepHours != null ? splitHours(health.sleepHours) : homeData.vitals.sleep;
  const sleepSub =
    health?.sleepScore != null ? `${Math.round(health.sleepScore)}% QUAL` : homeData.vitals.sleep.sub;
  // `habits` is null only while loading; an empty result ({done:0,total:0}) must
  // still win over the mock, else a user with no habits keeps the mock tally forever.
  const habitsDone = habits ? habits.done : homeData.vitals.habits.done;
  const habitsTotal = habits ? habits.total : homeData.vitals.habits.total;

  const now = new Date();
  const dayPct = dayProgressPct(now);

  const [focusTrackWidth, setFocusTrackWidth] = useState(0);
  const focusFillStyle = useFillAnim(homeData.focusSession.fillPct);
  // Times are always ink, never accent — except the dark-mode focus band time.
  const focusTimeColor = mode === "dark" ? c.accent : c.ink;

  const statItems: StatItem[] = [
    {
      label: "SLEEP",
      value: `${sleep.hours}:${sleep.minutes}`,
      sub: sleepSub,
    },
    {
      label: "NET WORTH",
      value: homeData.vitals.netWorth.value,
      sub: homeData.vitals.netWorth.sub,
      subColor: c.accent,
    },
    {
      label: "HABITS",
      value: `${habitsDone}/${habitsTotal}`,
      sub: "",
      pips: { n: habitsDone, of: habitsTotal },
      // State rule (spec): habits above half → green, else amber.
      pipColor: habitsDone * 2 > habitsTotal ? c.accent : c.amberPip,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader />

      <FadeUp index={0} style={styles.eyebrowGroup}>
        <Eyebrow left={eyebrowDate(now)} right={`DAY ${dayPct}%`} />
        <View style={styles.dayBarGap}>
          <DayBar pct={dayPct} />
        </View>
      </FadeUp>

      <FadeUp index={1} style={styles.titleGroup}>
        <TitleBlock title={`${greetingLead(now)}, Max.`} status={homeData.status} />
      </FadeUp>

      <View style={styles.bandGap}>
        <Band variant="accent" index={2}>
          <View style={styles.focusHeaderRow}>
            <Text style={t.bandLabel}>FOCUS</Text>
            <Text style={[t.eyebrow, styles.focusTime, { color: focusTimeColor }]}>
              {homeData.focusSession.time}
            </Text>
          </View>
          <Text style={[t.bandTitle, styles.focusTitle]}>{homeData.focusSession.title}</Text>
          <Text style={[t.bandSub, styles.focusSub]}>{homeData.focusSession.sub}</Text>
          <View
            onLayout={(e: LayoutChangeEvent) => setFocusTrackWidth(e.nativeEvent.layout.width)}
            style={[styles.progressTrack, { backgroundColor: c.dayTrack }]}
          >
            <Animated.View
              style={[styles.progressFill, { backgroundColor: c.accent }, focusFillStyle]}
            >
              {focusTrackWidth > 0 ? (
                <Shimmer width={(focusTrackWidth * homeData.focusSession.fillPct) / 100} />
              ) : null}
            </Animated.View>
          </View>
        </Band>
      </View>

      <View style={styles.bandGap}>
        <Band variant="recovery" index={3}>
          <Text style={t.statLabel}>RECOVERY</Text>
          <View style={styles.recoveryRow}>
            <RecoveryDial score={recoveryScore} />
            <HrvBars label="HRV · 7D" sub={`${hrv} MS · REST ${restHr}`} />
          </View>
        </Band>
      </View>

      <View style={styles.bandGap}>
        <StatGrid items={statItems} index={4} />
      </View>

      <FadeUp index={5} style={[styles.bandGap, styles.todaySection]}>
        <View style={styles.todayHeaderRow}>
          <Text style={t.sectionHeader}>TODAY</Text>
          <Text style={t.bandSub}>{homeData.today.meta}</Text>
        </View>
        {homeData.timeline.map((item) => (
          <LedgerRow
            key={`${item.time}-${item.title}`}
            time={item.time}
            title={item.title}
            tag={item.tag}
            state={item.state}
          />
        ))}
      </FadeUp>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    // No safe-area lib in this app (constraints.md: no new deps) — ScreenHeader's own
    // paddingTop is just breathing room, so the screen clears the status bar/notch itself
    // (same values the old Home content used).
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 140,
  },
  eyebrowGroup: {
    marginTop: 26,
  },
  dayBarGap: {
    marginTop: 10,
  },
  titleGroup: {
    marginTop: 21,
  },
  bandGap: {
    marginTop: 22,
  },
  focusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusTime: {
    letterSpacing: 0.76, // .08em × 9.5 — matches Eyebrow's right-stat tracking
  },
  focusTitle: {
    marginTop: 10,
  },
  focusSub: {
    marginTop: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: layout.radius.pill,
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: {
    height: 3,
    borderRadius: layout.radius.pill,
    overflow: "hidden",
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  todaySection: {
    paddingHorizontal: layout.gutter,
  },
  todayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
