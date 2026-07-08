import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { JournalField } from "../components/focus/JournalField";
import { LiveTimerBand } from "../components/focus/LiveTimerBand";
import { WeekStrip } from "../components/focus/WeekStrip";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { LedgerRow } from "../components/spec/LedgerRow";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { StatGrid } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import { focusData } from "../data/focus";
import { eyebrowDate } from "../lib/format";
import { FadeUp } from "../motion/FadeUp";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";
import { useQueueRows } from "./useQueueRows";

/**
 * Focus (spec §7c) — the working surface: a live deep-work timer + progress
 * (mock session, no provider yet) over a QUEUE ledger that stays fully live:
 * today's calendar (read), tasks (read + toggle), habits (read + toggle
 * today), and the journal (read + write, opened from its queue row). The
 * queue's live-data wiring + the clock tick live in useQueueRows.ts, the LIVE
 * band lives in components/focus/LiveTimerBand.tsx; App owns the ambient
 * background + bottom nav, this screen is the scrolling content.
 */
export function FocusScreen() {
  const { c, t } = useTheme();
  const { nowMs, queueRows, queueLoading, queueLeft, journalOpen, addJournalEntry } = useQueueRows();

  // Fixed once on mount so the timer counts up smoothly from the mock elapsed
  // time (data/focus.ts) rather than resetting on every re-render.
  const startMs = useMemo(() => Date.now() - focusData.session.elapsedAtLoadSec * 1000, []);
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const totalSec = focusData.session.blockMinutes * 60;
  const pct = Math.min(1, elapsedSec / totalSec);
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
        <LiveTimerBand
          nowMs={nowMs}
          elapsedSec={elapsedSec}
          endsAt={focusData.session.endsAt}
          label={focusData.session.label}
          pct={pct}
          index={1}
        />
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
});
