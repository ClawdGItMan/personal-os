import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionBar } from "../components/ActionBar";
import type { ActionBarItem } from "../components/ActionBar";
import { DetailFactsGrid } from "../components/detail/DetailFactsGrid";
import { DetailFactsRow } from "../components/detail/DetailFactsRow";
import type { Fact } from "../components/detail/DetailFactsRow";
import { DetailHeader } from "../components/detail/DetailHeader";
import { capitalize, formatDurationHM, formatRelativeDate, titleCaseFromSnake } from "../components/detail/detailFormat";
import { time12 } from "../lib/format";
import { useFocusSessions, useTasks } from "../lib/queries";
import { FadeUp } from "../motion/FadeUp";
import type { DetailItem } from "../navigation/NavContext";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

/**
 * Detail page (spec §5.5) — one shared template, content flexes by `item.kind`.
 * A pushed full-screen overlay that sits *under* the global TabBar (App
 * layers it before the nav), so the tab bar stays visible with Focus active.
 * Back chevron → close() returns to the previous screen.
 *
 * Task B8: content is now the REAL tapped item, not a canned mock. `item`
 * carries `kind`/`title` (the DetailItem contract) plus whatever fields the
 * opener spread onto it — this reads the underlying DB row's own field names
 * (`calendar_events`/`tasks`/`workouts` — see database.types.ts) defensively,
 * since callers vary in what they attach today. Any missing/malformed field
 * just omits its fact row rather than rendering "undefined". The old
 * AI-recommendations panel and "About" mock body copy are gone — there's no
 * real data source for either yet.
 *
 * Entrance choreography uses the shared FadeUp (motion/FadeUp), matching
 * every other screen.
 */

/** Reads an unknown field as a non-empty string, else undefined. */
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Reads an unknown field as a finite number, else undefined. */
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Eyebrow "type" word + humanized source/context tail, per kind. */
function eyebrowFor(item: DetailItem): { type: string; source: string } {
  if (item.kind === "event") {
    return { type: "Event", source: titleCaseFromSnake(asString(item.source) ?? "manual") };
  }
  if (item.kind === "workout") {
    return { type: "Workout", source: titleCaseFromSnake(asString(item.source) ?? "manual") };
  }
  return { type: "Task", source: `${capitalize(asString(item.priority) ?? "medium")} priority` };
}

/** `calendar_events` row fields → facts (When / Date / Where). */
function eventFacts(item: DetailItem): Fact[] {
  const facts: Fact[] = [];
  const starts = asString(item.starts_at);
  const ends = asString(item.ends_at);
  if (starts) {
    facts.push({ label: "When", value: ends ? `${time12(starts)} → ${time12(ends)}` : time12(starts) });
    facts.push({ label: "Date", value: formatRelativeDate(starts) });
  }
  const location = asString(item.location);
  if (location) facts.push({ label: "Where", value: location, muted: true });
  return facts;
}

/** `tasks` row fields → facts (Due / Priority / Tags / State). */
function taskFacts(item: DetailItem): Fact[] {
  const facts: Fact[] = [];
  const dueAt = asString(item.due_at);
  if (dueAt) facts.push({ label: "Due", value: `${formatRelativeDate(dueAt)} · ${time12(dueAt)}` });
  const priority = asString(item.priority);
  if (priority) facts.push({ label: "Priority", value: capitalize(priority) });
  const tags = Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === "string" && t.length > 0) : [];
  if (tags.length > 0) facts.push({ label: "Tags", value: tags.join(", "), muted: true });
  facts.push({ label: "State", value: item.done === true ? "Done" : "Open" });
  return facts;
}

/** `workouts` row fields → the facts grid (sport/duration/strain/HR/energy/distance/started). */
function workoutFacts(item: DetailItem): Fact[] {
  const facts: Fact[] = [{ label: "Sport", value: titleCaseFromSnake(asString(item.sport) ?? "workout") }];

  const durationSec = asNumber(item.duration_sec);
  if (durationSec != null && durationSec > 0) facts.push({ label: "Duration", value: formatDurationHM(durationSec) });

  const strain = asNumber(item.strain);
  if (strain != null) facts.push({ label: "Strain", value: strain.toFixed(1) });

  const avgHr = asNumber(item.avg_hr);
  if (avgHr != null) facts.push({ label: "Avg HR", value: `${Math.round(avgHr)} bpm` });

  const maxHr = asNumber(item.max_hr);
  if (maxHr != null) facts.push({ label: "Max HR", value: `${Math.round(maxHr)} bpm` });

  const energyKj = asNumber(item.energy_kj);
  if (energyKj != null) facts.push({ label: "Energy", value: `${Math.round(energyKj / 4.184)} kcal` });

  const distanceM = asNumber(item.distance_m);
  if (distanceM != null && distanceM > 0) facts.push({ label: "Distance", value: `${(distanceM / 1000).toFixed(1)} km` });

  const startedAt = asString(item.started_at);
  if (startedAt) facts.push({ label: "Started", value: time12(startedAt) });

  return facts;
}

type ActionsCtx = {
  close: () => void;
  toggleTask: (id: string, next: boolean) => Promise<void>;
  snoozeTask: (id: string, untilIso: string) => Promise<void>;
  startFocus: (label: string, plannedMinutes: number) => Promise<void>;
};

/** Event → "Start focus block" (always) + "Open in Calendar" (google_calendar + external_id only). */
function eventActions(item: DetailItem, ctx: ActionsCtx): ActionBarItem[] {
  const actions: ActionBarItem[] = [];
  const starts = asString(item.starts_at);
  const ends = asString(item.ends_at);
  let minutes = 50;
  if (starts && ends) {
    const diff = Math.round((new Date(ends).getTime() - new Date(starts).getTime()) / 60000);
    if (diff > 0) minutes = diff;
  }
  actions.push({
    label: "Start focus block",
    primary: true,
    onPress: async () => {
      await ctx.startFocus(item.title, minutes);
      ctx.close();
    },
  });

  const source = asString(item.source);
  const externalId = asString(item.external_id);
  if (externalId && source === "google_calendar") {
    actions.push({
      label: "Open in Calendar",
      onPress: () => {
        void Linking.openURL("https://calendar.google.com/calendar/r");
      },
    });
  }
  return actions;
}

/** Task → Complete/Reopen (toggles on done) + Snooze +1 day. Needs `item.id`; omits actions if it's missing. */
function taskActions(item: DetailItem, ctx: ActionsCtx): ActionBarItem[] {
  const id = asString(item.id);
  if (!id) return [];
  const done = item.done === true;
  const dueAt = asString(item.due_at);

  return [
    {
      label: done ? "Reopen" : "Complete",
      primary: true,
      onPress: async () => {
        await ctx.toggleTask(id, !done);
        ctx.close();
      },
    },
    {
      label: "Snooze +1 day",
      onPress: async () => {
        const base = dueAt ? new Date(dueAt) : new Date();
        base.setDate(base.getDate() + 1);
        await ctx.snoozeTask(id, base.toISOString());
        ctx.close();
      },
    },
  ];
}

export function DetailScreen({ item }: { item: DetailItem }) {
  const { c } = useTheme();
  const { close } = useNav();
  const { toggleTask, snoozeTask } = useTasks();
  const { start } = useFocusSessions();

  const eyebrow = eyebrowFor(item);
  const facts = item.kind === "event" ? eventFacts(item) : item.kind === "task" ? taskFacts(item) : workoutFacts(item);
  const ctx: ActionsCtx = { close, toggleTask, snoozeTask, startFocus: start };
  const actions = item.kind === "event" ? eventActions(item, ctx) : item.kind === "task" ? taskActions(item, ctx) : [];

  return (
    <View style={[styles.host, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DetailHeader onBack={close} />

        <FadeUp index={0}>
          <View style={styles.eyebrow}>
            <View
              style={
                item.kind === "event"
                  ? [styles.dotEvent, { backgroundColor: c.accent }]
                  : item.kind === "workout"
                    ? [styles.dotWorkout, { backgroundColor: c.ink50 }]
                    : [styles.dotTask, { borderColor: c.ink50 }]
              }
            />
            <Text style={[styles.eyebrowType, { color: c.accent }]}>{eyebrow.type}</Text>
            <Text style={[styles.eyebrowSource, { color: c.ink38 }]}>· {eyebrow.source}</Text>
          </View>
          <Text style={[styles.title, { color: c.ink }]}>{item.title}</Text>
        </FadeUp>

        <FadeUp index={1}>
          {item.kind === "workout" ? (
            <DetailFactsGrid facts={facts} />
          ) : (
            <View style={[styles.facts, { borderColor: c.hairSection }]}>
              {facts.map((fact) => (
                <DetailFactsRow key={fact.label} fact={fact} />
              ))}
            </View>
          )}
        </FadeUp>

        {actions.length > 0 ? (
          <FadeUp index={2}>
            <ActionBar actions={actions} />
          </FadeUp>
        ) : null}
      </ScrollView>
    </View>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  dotEvent: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  dotTask: {
    width: DOT,
    height: DOT,
    borderRadius: 2,
    borderWidth: 1.4,
  },
  dotWorkout: {
    width: DOT - 1,
    height: DOT - 1,
    borderRadius: 2,
  },
  eyebrowType: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  eyebrowSource: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.sans700,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    marginTop: 9,
  },
  facts: {
    marginTop: 20,
    borderTopWidth: 1,
  },
});
