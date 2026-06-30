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
import { focusData } from "../data/focus";
import { color, font, space, type } from "../theme/tokens";

/**
 * Focus (spec §5.4) — the complete working surface: Calendar (Google Cal week
 * strip + today's events) → Tasks (grouped, with progress) → Habits → Journal.
 * Every event/task row taps into the shared Detail page. App owns the ambient
 * background + bottom nav; this screen is just the scrolling content.
 */
export function FocusScreen() {
  const { calendar, tasks, habits, journal } = focusData;
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
        <SectionHeader title="Calendar" meta={calendar.meta} />
        <WeekStrip days={calendar.week} />
        <View style={styles.events}>
          {calendar.events.map((ev, i) => (
            <EventRow
              key={`${ev.time}-${ev.title}`}
              time={ev.time}
              state={ev.state}
              title={ev.title}
              sub={ev.sub}
              last={i === calendar.events.length - 1}
              detail={{ kind: "event", title: ev.title }}
            />
          ))}
        </View>
      </SectionEnter>

      <SectionEnter index={2}>
        <SectionHeader title="Tasks" meta={tasks.meta} />
        <ProgressBar pct={tasks.donePct} height={5} />
        <Text style={styles.group}>Today</Text>
        {tasks.today.map((t, i) => (
          <TaskRow
            key={t.title}
            title={t.title}
            sub={t.sub}
            done={t.done}
            timeBlocked={t.timeBlocked}
            priority={t.priority}
            last={i === tasks.today.length - 1}
            detail={{ kind: "task", title: t.title }}
          />
        ))}
        <Text style={styles.group}>This week</Text>
        {tasks.week.map((t, i) => (
          <TaskRow
            key={t.title}
            title={t.title}
            sub={t.sub}
            last={i === tasks.week.length - 1}
            detail={{ kind: "task", title: t.title }}
          />
        ))}
      </SectionEnter>

      <SectionEnter index={3}>
        <SectionHeader title="Habits" />
        {habits.map((h, i) => (
          <HabitRow key={h.name} habit={h} last={i === habits.length - 1} />
        ))}
      </SectionEnter>

      <SectionEnter index={4}>
        <SectionHeader title="Journal" meta={journal.meta} />
        <JournalField prompt={journal.prompt} placeholder={journal.placeholder} />
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
});
