import { useCallback, useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { LiveTimerBand } from "../components/focus/LiveTimerBand";
import { formatCompact } from "../components/money/format";
import { Band } from "../components/spec/Band";
import { DayBar } from "../components/spec/DayBar";
import { Eyebrow } from "../components/spec/Eyebrow";
import { HrvBars } from "../components/spec/HrvBars";
import { LedgerRow } from "../components/spec/LedgerRow";
import { RecoveryDial } from "../components/spec/RecoveryDial";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { Skeleton } from "../components/spec/Skeleton";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import type { StatusSegment } from "../components/spec/TitleBlock";
import {
  dayProgressPct,
  fallbackStatusSegments,
  firstUpcomingEvent,
  formatNetWorthPctLabel,
  greetingLead,
  homeData,
  isBriefFresh,
  netWorthChangePct,
  nextFocusBandContent,
  splitHours,
  todayMetaLabel,
} from "../data/home";
import type { BriefEnvelope } from "../lib/assistant/api";
import { getBrief } from "../lib/assistant/api";
import { eyebrowDate } from "../lib/format";
import { useCalendarToday, useFocusSessions, useHealthToday, useHomeHabits, useMoney } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import { layout } from "../theme/layout";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
import { useQueueRows } from "./useQueueRows";

const DEFAULT_SESSION_LABEL = "Deep work";
const DEFAULT_SESSION_MINUTES = 50;

/**
 * Home (design README §Home, spec 6b/6c) — eyebrow/day-bar, greeting, the
 * live FOCUS band, RECOVERY band, 3-col vitals, and the TODAY ledger. Capture
 * lives in the tab bar's ⊕; the Assistant sheet lives behind the spark button
 * in ScreenHeader. TabBar is rendered by the shell (App.tsx).
 *
 * Task B5: FOCUS band, status line, TODAY ledger, and NET WORTH stat are now
 * live. FOCUS reuses B4's `LiveTimerBand` (LIVE/START states unchanged) plus
 * a Home-only NEXT state (no active session, a calendar event starts within
 * 8h) built from the pure helpers in data/home.ts. TODAY ledger reuses
 * useQueueRows.ts's shared row-builder in "today-all" mode (full day,
 * calendar + tasks, no habits/journal, tasks tap-to-openDetail). The status
 * line prefers a fresh (<12h) assistant brief, fetched fire-and-forget on
 * mount, falling back to a deterministic line composed from live recovery +
 * next-event data. Health/habits/sleep keep their pre-existing mock-fallback
 * merge (unchanged) but now gate behind a loading skeleton alongside money.
 */
export function HomeScreen() {
  const { c, t } = useTheme();

  const { data: health, loading: healthLoading, refetch: refetchHealth } = useHealthToday();
  const { data: habits, loading: habitsLoading, refetch: refetchHabits } = useHomeHabits();
  const money = useMoney();
  const focus = useFocusSessions();
  const calendar = useCalendarToday();
  const { nowMs, queueRows, queueLoading, refetch: refetchQueue } = useQueueRows("today-all");

  // Pull-to-refresh: every hook this screen reads exposes (or now exposes,
  // task C1) a refetch — fire them together. Note `calendar` here and
  // useQueueRows' internal calendar are separate hook instances (separate
  // fetches, not shared state), so both need their own refetch call. None of
  // these hooks expose a distinct "refreshing" flag (only an initial-load
  // `loading`), so this screen tracks its own — otherwise RefreshControl's
  // spinner would retract the instant `onRefresh` fires instead of holding
  // through the fetch.
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchHealth(),
        refetchHabits(),
        money.refetch(),
        focus.refetch(),
        calendar.refetch(),
        refetchQueue(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchHealth, refetchHabits, money.refetch, focus.refetch, calendar.refetch, refetchQueue]);

  const [brief, setBrief] = useState<BriefEnvelope | null>(null);

  // Fire-and-forget: the status line falls back to the deterministic line
  // below on any failure (offline, assistant not configured, 401, etc.) — no
  // error state to show, this just never overrides the fallback.
  useEffect(() => {
    let active = true;
    getBrief()
      .then((envelope) => {
        if (active) setBrief(envelope);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
  const vitalsLoading = healthLoading || habitsLoading || money.loading;

  const upcoming = firstUpcomingEvent(calendar.data, nowMs);

  const statusSegments: StatusSegment[] =
    brief != null && brief.brief.statusLine.trim().length > 0 && isBriefFresh(brief.generatedAt, nowMs)
      ? [brief.brief.statusLine]
      : fallbackStatusSegments(recoveryScore, upcoming);

  const focusBandLoading = focus.loading || calendar.loading;
  const nextBand = focusBandLoading || focus.active ? null : nextFocusBandContent(upcoming, nowMs);

  const netWorthPct = netWorthChangePct(money.netWorthSeries30d);
  const netWorthSub = netWorthPct != null ? formatNetWorthPctLabel(netWorthPct) : "—";
  const netWorthSubColor = netWorthPct == null ? undefined : netWorthPct >= 0 ? c.accent : c.red;

  const statItems: StatItem[] = [
    {
      label: "SLEEP",
      value: `${sleep.hours}:${sleep.minutes}`,
      sub: sleepSub,
    },
    {
      label: "NET WORTH",
      value: formatCompact(money.netWorth),
      sub: netWorthSub,
      subColor: netWorthSubColor,
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
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl tintColor={c.ink50} refreshing={refreshing} onRefresh={() => void refreshAll()} />}
    >
      <ScreenHeader />

      <FadeUp index={0} style={styles.eyebrowGroup}>
        <Eyebrow left={eyebrowDate(now)} right={`DAY ${dayPct}%`} />
        <View style={styles.dayBarGap}>
          <DayBar pct={dayPct} />
        </View>
      </FadeUp>

      <FadeUp index={1} style={styles.titleGroup}>
        <TitleBlock title={`${greetingLead(now)}, Max.`} status={statusSegments} />
      </FadeUp>

      <View style={styles.bandGap}>
        {nextBand ? (
          <Band variant="accent" index={2}>
            <Text style={t.bandLabel}>NEXT</Text>
            <Text style={[t.bandTitle, styles.focusTitle]}>{nextBand.title}</Text>
            <Text style={[t.bandSub, styles.focusSub]}>{nextBand.sub}</Text>
          </Band>
        ) : (
          <LiveTimerBand
            nowMs={nowMs}
            active={focus.active}
            loading={focusBandLoading}
            onStart={() => void focus.start(DEFAULT_SESSION_LABEL, DEFAULT_SESSION_MINUTES)}
            onEnd={() => void focus.end()}
            index={2}
          />
        )}
      </View>

      <View style={styles.bandGap}>
        <Band variant="recovery" index={3}>
          <Text style={t.statLabel}>RECOVERY</Text>
          {vitalsLoading ? (
            <View style={styles.recoveryRow}>
              <Skeleton width={126} height={66} radius={8} />
              <View style={styles.recoverySkeletonCol}>
                <Skeleton width={70} height={10} radius={2} />
                <Skeleton width={90} height={26} radius={3} />
                <Skeleton width={80} height={9} radius={2} />
              </View>
            </View>
          ) : (
            <View style={styles.recoveryRow}>
              <RecoveryDial score={recoveryScore} />
              <HrvBars label="HRV · 7D" sub={`${hrv} MS · REST ${restHr}`} />
            </View>
          )}
        </Band>
      </View>

      <View style={styles.bandGap}>
        {vitalsLoading ? (
          <FadeUp index={4}>
            <View style={[styles.statSkeletonRow, { borderColor: c.hairSection }]}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.statSkeletonCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairCol }]}
                >
                  <Skeleton width={54} height={9} radius={2} />
                  <View style={styles.statSkeletonValueGap}>
                    <Skeleton width={70} height={20} radius={3} />
                  </View>
                  <View style={styles.statSkeletonSubGap}>
                    <Skeleton width={60} height={9} radius={2} />
                  </View>
                </View>
              ))}
            </View>
          </FadeUp>
        ) : (
          <StatGrid items={statItems} index={4} />
        )}
      </View>

      <FadeUp index={5} style={[styles.bandGap, styles.todaySection]}>
        <View style={styles.todayHeaderRow}>
          <Text style={t.sectionHeader}>TODAY</Text>
          <Text style={t.bandSub}>{calendar.loading ? "…" : todayMetaLabel(calendar.data)}</Text>
        </View>
        {queueLoading ? (
          <Text style={[styles.quiet, { color: c.ink50 }]}>Loading…</Text>
        ) : (
          queueRows.map((item) => (
            <LedgerRow
              key={item.key}
              time={item.time}
              title={item.title}
              tag={item.tag}
              state={item.state}
              onPress={item.onPress}
              haptic={item.haptic}
            />
          ))
        )}
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
  focusTitle: {
    marginTop: 10,
  },
  focusSub: {
    marginTop: 6,
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  recoverySkeletonCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  statSkeletonRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: layout.bandPadV,
    paddingHorizontal: layout.gutter,
  },
  statSkeletonCell: {
    flex: 1,
    paddingRight: 12,
  },
  statSkeletonValueGap: {
    marginTop: 9,
  },
  statSkeletonSubGap: {
    marginTop: 8,
  },
  todaySection: {
    paddingHorizontal: layout.gutter,
  },
  todayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quiet: {
    fontFamily: fonts.sans500,
    fontSize: 13,
    paddingVertical: 14,
  },
});
