import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { JournalField } from "../components/focus/JournalField";
import { WeekStrip } from "../components/focus/WeekStrip";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { LedgerRow } from "../components/spec/LedgerRow";
import type { LedgerState } from "../components/spec/LedgerRow";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { StatGrid } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import {
  extractDueTime12h,
  eyebrowDate,
  focusData,
  formatClock12h,
  formatElapsed,
  formatEventTime12h,
  formatHHMM12h,
} from "../data/focus";
import { useCalendarToday, useHabits, useJournal, useTasks } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import { Shimmer } from "../motion/Shimmer";
import { useFillAnim } from "../motion/useFillAnim";
import { useTheme } from "../theme/ThemeContext";
import { layout } from "../theme/layout";
import { fonts } from "../theme/typeRoles";

type QueueRowVM = {
  key: string;
  time: string;
  title: string;
  tag: "CAL" | "TASK" | "HABIT" | "JOURNAL";
  state: LedgerState;
  onPress?: () => void;
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ticks once a second — drives the live "44:12" timer and the band's clock. */
function useNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return nowMs;
}

/**
 * Focus (spec §7c) — the working surface: a live deep-work timer + progress
 * (mock session, no provider yet) over a QUEUE ledger that stays fully live:
 * today's calendar (read), tasks (read + toggle), habits (read + toggle
 * today), and the journal (read + write, opened from its queue row). App owns
 * the ambient background + bottom nav; this screen is the scrolling content.
 */
export function FocusScreen() {
  const { c, t, mode } = useTheme();
  const calendar = useCalendarToday();
  const tasks = useTasks();
  const habits = useHabits();
  const journal = useJournal();
  const [journalOpen, setJournalOpen] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const nowMs = useNowMs();
  // Fixed once on mount so the timer counts up smoothly from the mock elapsed
  // time (data/focus.ts) rather than resetting on every re-render.
  const startMs = useMemo(() => Date.now() - focusData.session.elapsedAtLoadSec * 1000, []);
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const totalSec = focusData.session.blockMinutes * 60;
  const pct = Math.min(1, elapsedSec / totalSec);
  const fillStyle = useFillAnim(pct * 100);

  const calendarRows: QueueRowVM[] = calendar.data.map((ev) => ({
    key: `cal-${ev.id}`,
    time: formatEventTime12h(ev.time),
    title: ev.title,
    tag: "CAL",
    state: ev.state === "done" ? "done" : "up",
  }));

  const taskRows: QueueRowVM[] = tasks.today.map((item) => ({
    key: `task-${item.id}`,
    time: extractDueTime12h(item.sub) ?? "—",
    title: item.title,
    tag: "TASK",
    state: item.done ? "done" : "up",
    onPress: () => void tasks.toggleTask(item.id, !item.done),
  }));

  const habitRows: QueueRowVM[] = habits.data.map((h) => ({
    key: `habit-${h.id}`,
    time: "—",
    title: h.name,
    tag: "HABIT",
    state: h.todayDone ? "done" : "up",
    onPress: () => void habits.toggleHabitToday(h.id, !h.todayDone),
  }));

  const journalDoneToday =
    journal.lastEntry != null && isSameLocalDay(new Date(journal.lastEntry.written_at), new Date());
  const journalRow: QueueRowVM = {
    key: "journal",
    time: "—",
    title: focusData.journal.prompt,
    tag: "JOURNAL",
    state: journalDoneToday ? "done" : "up",
    onPress: () => setJournalOpen((v) => !v),
  };

  const queueRows = [...calendarRows, ...taskRows, ...habitRows, journalRow];
  const queueLoading = calendar.loading || tasks.loading || habits.loading || journal.loading;
  const queueLeft = queueRows.filter((r) => r.state === "up").length;
  const now = new Date();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader />

      <FadeUp index={0}>
        <View style={styles.eyebrowSpace}>
          <Eyebrow left={eyebrowDate(now)} right={`${focusData.stats.deepHours} DEEP TODAY`} />
        </View>
        <View style={styles.titleSpace}>
          <TitleBlock title={focusData.title} status={focusData.status} />
        </View>
      </FadeUp>

      <View style={styles.firstBand}>
        <Band variant="accent" index={1}>
          <View style={styles.liveHeaderRow}>
            <Text style={t.bandLabel}>Live · Deep work</Text>
            <Text style={[styles.clock, { color: mode === "dark" ? c.accent : c.ink }]}>
              {formatClock12h(new Date(nowMs))}
            </Text>
          </View>
          <View style={styles.timerRow}>
            <Text style={t.timerValue}>{formatElapsed(elapsedSec)}</Text>
            <Text style={t.bandSub}>{`Ends ${formatHHMM12h(focusData.session.endsAt)}`}</Text>
          </View>
          <Text style={[styles.sessionSub, { color: c.ink64 }]}>{focusData.session.label}</Text>
          <View
            style={[styles.progressTrack, { backgroundColor: c.dialTrack }]}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View style={[styles.progressFill, { backgroundColor: c.accent }, fillStyle]}>
              <Shimmer width={trackWidth * pct} />
            </Animated.View>
          </View>
        </Band>
      </View>

      <StatGrid
        index={2}
        items={[
          {
            label: "SESSIONS",
            value: `${focusData.stats.sessions.done}/${focusData.stats.sessions.total}`,
            sub: `${focusData.stats.sessions.left} LEFT`,
          },
          {
            label: "DEEP HRS",
            value: focusData.stats.deepHours,
            sub: `GOAL ${focusData.stats.deepGoal}`,
          },
          {
            label: "STREAK",
            value: String(focusData.stats.streakDays),
            sub: "DAYS",
            valueColor: c.accent,
          },
        ]}
      />

      <Band variant="plain" index={3}>
        <View style={styles.sectionHeaderRow}>
          <Text style={t.sectionHeader}>This week</Text>
          <Text style={t.bandSub}>{`${focusData.week.rangeLabel} · ${focusData.week.avgLabel}`}</Text>
        </View>
        <WeekStrip days={focusData.week.days} />
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
            onSubmit={journal.addEntry}
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
  liveHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clock: {
    fontFamily: fonts.mono600,
    fontSize: 14,
    letterSpacing: -0.28,
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
  },
  sessionSub: {
    fontFamily: fonts.sans500,
    fontSize: 13,
    marginTop: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: layout.radius.pill,
    marginTop: 15,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: layout.radius.pill,
    overflow: "hidden",
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
});
