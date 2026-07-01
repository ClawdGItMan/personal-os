import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { EventRow } from "../components/EventRow";
import { ProgressBar } from "../components/ProgressBar";
import { SectionEnter } from "../components/SectionEnter";
import { SectionHeader } from "../components/SectionHeader";
import { TaskRow } from "../components/TaskRow";
import { HabitRow } from "../components/focus/HabitRow";
import { JournalField } from "../components/focus/JournalField";
import { WeekStrip } from "../components/focus/WeekStrip";
import type { WeekDay } from "../data/focus";
import { focusData } from "../data/focus";
import { useCalendarToday, useHabits, useJournal, useTasks } from "../lib/queries";
import { color, font, space, type } from "../theme/tokens";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** The current Mon–Sun week as WeekStrip cells, with today flagged. */
function useCurrentWeek(): WeekDay[] {
  return useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0 = Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      days.push({
        letter: WEEKDAY_LETTERS[d.getDay()],
        date: String(d.getDate()),
        dense: false,
        today: isToday,
      });
    }
    return days;
  }, []);
}

/**
 * Focus (spec §5.4) — the complete working surface, now LIVE: Calendar (today's
 * events, read) → Tasks (grouped, read + toggle) → Habits (read + toggle today) →
 * Journal (read + write). Every event/task row taps into the shared Detail page.
 * App owns the ambient background + bottom nav; this screen is the scrolling
 * content. Data comes from Supabase via src/lib/queries hooks; empty tables show
 * a quiet state rather than crashing.
 */
export function FocusScreen() {
  const week = useCurrentWeek();
  const calendar = useCalendarToday();
  const tasks = useTasks();
  const habits = useHabits();
  const journal = useJournal();

  const calendarMeta = calendar.loading
    ? "GOOGLE CAL · …"
    : `GOOGLE CAL · ${calendar.data.length} TODAY`;
  const tasksMeta = tasks.loading ? "…" : `${tasks.todayDoneCount} / ${tasks.todayTotal} DONE`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader recoveryPct={focusData.recoveryPct} tone={color.fg1} />

      <SectionEnter index={0}>
        <Text style={[type.eyebrow, styles.eyebrow]}>{focusData.eyebrow}</Text>
        <Text style={type.screenTitle}>
          {focusData.title.lead}
          <Text style={type.screenTitleItalic}>{focusData.title.emphasis}</Text>
        </Text>
      </SectionEnter>

      <SectionEnter index={1}>
        <SectionHeader title="Calendar" meta={calendarMeta} />
        <WeekStrip days={week} />
        <View style={styles.events}>
          {calendar.loading ? (
            <Text style={styles.quiet}>Loading today…</Text>
          ) : calendar.data.length === 0 ? (
            <Text style={styles.quiet}>Nothing on the calendar today.</Text>
          ) : (
            calendar.data.map((ev, i) => (
              <EventRow
                key={ev.id}
                time={ev.time}
                state={ev.state}
                title={ev.title}
                sub={ev.sub}
                last={i === calendar.data.length - 1}
                detail={{ kind: "event", title: ev.title }}
              />
            ))
          )}
        </View>
      </SectionEnter>

      <SectionEnter index={2}>
        <SectionHeader title="Tasks" meta={tasksMeta} />
        <ProgressBar pct={tasks.todayDonePct} height={5} />
        <Text style={styles.group}>Today</Text>
        {tasks.loading ? (
          <Text style={styles.quiet}>Loading tasks…</Text>
        ) : tasks.today.length === 0 ? (
          <Text style={styles.quiet}>No tasks for today.</Text>
        ) : (
          tasks.today.map((t, i) => (
            <TaskRow
              key={t.id}
              title={t.title}
              sub={t.sub}
              done={t.done}
              timeBlocked={t.timeBlocked}
              priority={t.priority}
              last={i === tasks.today.length - 1}
              detail={{ kind: "task", title: t.title }}
              onToggle={(next) => void tasks.toggleTask(t.id, next)}
            />
          ))
        )}
        {!tasks.loading && tasks.week.length > 0 ? (
          <>
            <Text style={styles.group}>This week</Text>
            {tasks.week.map((t, i) => (
              <TaskRow
                key={t.id}
                title={t.title}
                sub={t.sub}
                done={t.done}
                timeBlocked={t.timeBlocked}
                priority={t.priority}
                last={i === tasks.week.length - 1}
                detail={{ kind: "task", title: t.title }}
                onToggle={(next) => void tasks.toggleTask(t.id, next)}
              />
            ))}
          </>
        ) : null}
      </SectionEnter>

      <SectionEnter index={3}>
        <SectionHeader title="Habits" />
        {habits.loading ? (
          <Text style={styles.quiet}>Loading habits…</Text>
        ) : habits.data.length === 0 ? (
          <Text style={styles.quiet}>No habits yet.</Text>
        ) : (
          habits.data.map((h, i) => (
            <HabitRow
              key={h.id}
              habit={h}
              last={i === habits.data.length - 1}
              todayDone={h.todayDone}
              onToggleToday={(next) => void habits.toggleHabitToday(h.id, next)}
            />
          ))
        )}
      </SectionEnter>

      <SectionEnter index={4}>
        <SectionHeader title="Journal" meta={journal.loading ? undefined : journal.meta} />
        <JournalField
          prompt={focusData.journal.prompt}
          placeholder={focusData.journal.placeholder}
          onSubmit={journal.addEntry}
        />
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
  eyebrow: {
    marginBottom: 14,
  },
  events: {
    marginTop: 10,
  },
  group: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: color.fg4,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 2,
  },
  quiet: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.fg4,
    paddingVertical: 14,
  },
});
