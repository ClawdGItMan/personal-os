import { useCallback, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { JournalField } from "../components/focus/JournalField";
import { LiveTimerBand } from "../components/focus/LiveTimerBand";
import { WeekStrip } from "../components/focus/WeekStrip";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { LedgerRow } from "../components/spec/LedgerRow";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { StatGrid } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import { buildWeekCells, focusData, formatMinutesHM, weekAvgLabel, weekRangeLabel } from "../data/focus";
import { eyebrowDate } from "../lib/format";
import { useFocusSessions } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import { layout } from "../theme/layout";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
import { useQueueRows } from "./useQueueRows";

const DAILY_SESSION_GOAL = 4;
const DEFAULT_SESSION_LABEL = "Deep work";
const DEFAULT_SESSION_MINUTES = 50;

/**
 * Focus (spec §7c) — the working surface: a live deep-work timer + progress
 * over a QUEUE ledger that stays fully live: today's calendar (read), tasks
 * (read + toggle), habits (read + toggle today), and the journal (read +
 * write, opened from its queue row). The queue's live-data wiring + the
 * clock tick live in useQueueRows.ts; the deep-work session (LIVE/START
 * band, stats, week strip) is wired here off useFocusSessions. The LIVE/
 * START band lives in components/focus/LiveTimerBand.tsx; App owns the
 * ambient background + bottom nav, this screen is the scrolling content.
 */
export function FocusScreen() {
  const { c, t } = useTheme();
  const { nowMs, queueRows, queueLoading, queueLeft, journalOpen, addJournalEntry, refetch: refetchQueue } =
    useQueueRows();
  const focus = useFocusSessions();

  const now = new Date();
  const weekCells = buildWeekCells(focus.weekMinutes, now);

  // Pull-to-refresh: every hook this screen reads exposes a refetch. Neither
  // exposes a distinct "refreshing" flag, so this screen tracks its own (see
  // HomeScreen's refreshAll for the same note).
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchQueue(), focus.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchQueue, focus.refetch]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl tintColor={c.ink50} refreshing={refreshing} onRefresh={() => void refreshAll()} />}
    >
      <ScreenHeader />

      <FadeUp index={0}>
        <View style={styles.eyebrowSpace}>
          <Eyebrow
            left={eyebrowDate(now)}
            right={`${focus.loading ? "…" : formatMinutesHM(focus.todayStats.deepMinutes)} DEEP TODAY`}
          />
        </View>
        <View style={styles.titleSpace}>
          <TitleBlock title={focusData.title} status={focusData.status} />
        </View>
        {focus.error ? (
          <Text style={[styles.errorText, { color: c.red }]}>{`COULDN'T LOAD FOCUS DATA — ${focus.error}`}</Text>
        ) : null}
      </FadeUp>

      <View style={styles.firstBand}>
        <LiveTimerBand
          nowMs={nowMs}
          active={focus.active}
          loading={focus.loading}
          onStart={() => void focus.start(DEFAULT_SESSION_LABEL, DEFAULT_SESSION_MINUTES)}
          onEnd={() => void focus.end()}
          index={1}
        />
      </View>

      <StatGrid
        index={2}
        items={[
          {
            label: "SESSIONS",
            value: focus.loading ? "…" : `${focus.todayStats.sessions}/${DAILY_SESSION_GOAL}`,
            sub: focus.loading ? "…" : `${Math.max(0, DAILY_SESSION_GOAL - focus.todayStats.sessions)} LEFT`,
          },
          {
            label: "DEEP HRS",
            value: focus.loading ? "…" : formatMinutesHM(focus.todayStats.deepMinutes),
            sub: "GOAL 4:00",
          },
          {
            label: "STREAK",
            value: focus.loading ? "…" : String(focus.streakDays),
            sub: "DAYS",
            valueColor: c.accent,
          },
        ]}
      />

      <Band variant="plain" index={3}>
        <View style={styles.sectionHeaderRow}>
          <Text style={t.sectionHeader}>This week</Text>
          <Text style={t.bandSub}>
            {focus.loading ? "…" : `${weekRangeLabel(now)} · ${weekAvgLabel(weekCells)}`}
          </Text>
        </View>
        <WeekStrip days={weekCells} loading={focus.loading} />
      </Band>

      <Band variant="plain" index={4}>
        <View style={styles.sectionHeaderRow}>
          <Text style={t.sectionHeader}>Queue</Text>
          <Text style={t.bandSub}>{queueLoading ? "…" : `${queueLeft} LEFT`}</Text>
        </View>
        {queueLoading ? (
          <Text style={[styles.quiet, { color: c.ink50 }]}>Loading…</Text>
        ) : (
          queueRows.map((row) => (
            <LedgerRow
              key={row.key}
              time={row.time}
              title={row.title}
              tag={row.tag}
              state={row.state}
              onPress={row.onPress}
            />
          ))
        )}
        {journalOpen ? (
          <JournalField
            prompt={focusData.journal.prompt}
            placeholder={focusData.journal.placeholder}
            onSubmit={addJournalEntry}
          />
        ) : null}
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quiet: {
    fontFamily: fonts.sans500,
    fontSize: 13,
    paddingVertical: 14,
  },
  errorText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 10,
    paddingHorizontal: layout.gutter,
  },
});
