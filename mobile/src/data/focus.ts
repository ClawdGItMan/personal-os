/**
 * Sample Focus data — content from the approved focus-v2 mockup, reconciled to
 * the locked screen brief. Replaced by Google Calendar (events) + the native
 * Supabase store (tasks/habits/journal) when the data layer lands (spec §7).
 */
import type { EventState } from "../components/EventRow";

export type FocusEvent = {
  time: string;
  state: EventState;
  title: string;
  sub: string;
};

export type FocusTask = {
  title: string;
  sub: string;
  done?: boolean;
  timeBlocked?: boolean;
  priority?: boolean;
};

export type WeekDay = {
  /** Single-letter weekday (M T W T F S S). */
  letter: string;
  /** Day-of-month number. */
  date: string;
  /** Has events that day → render the density dot. */
  dense: boolean;
  /** Today → blue tint + blue border. */
  today?: boolean;
};

/** 7 week-dots per habit: done | empty | today (blue ring, may also be done). */
export type HabitDot = "done" | "empty" | "today";

export type Habit = {
  name: string;
  /** Streak read-out, e.g. "12-day streak" or "Streak reset · 0". */
  streak: string;
  /** A reset streak reads in muted fg4 (never red). */
  reset?: boolean;
  dots: HabitDot[];
};

export const focusData = {
  eyebrow: "Focus · Friday, May 8",
  title: { lead: "Two deep blocks ", emphasis: "left." },
  recoveryPct: 0.72,

  calendar: {
    meta: "GOOGLE CAL · 8 TODAY",
    week: [
      { letter: "M", date: "4", dense: true },
      { letter: "T", date: "5", dense: true },
      { letter: "W", date: "6", dense: false },
      { letter: "T", date: "7", dense: true },
      { letter: "F", date: "8", dense: true, today: true },
      { letter: "S", date: "9", dense: false },
      { letter: "S", date: "10", dense: true },
    ] satisfies WeekDay[],
    events: [
      { time: "09:30", state: "done", title: "Standup", sub: "Ops · done" },
      { time: "10:00", state: "done", title: "1:1 · Sarah K", sub: "Calendar · done" },
      { time: "12:30", state: "up", title: "Lunch · Adam", sub: "Calendar · Cipriani" },
      { time: "NOW", state: "now", title: "Deep work — pricing model", sub: "In progress · until 15:00" },
      { time: "15:00", state: "up", title: "Investor call — Sequoia", sub: "Calendar · video · 45m" },
      { time: "19:30", state: "up", title: "Dinner · Cipriani", sub: "Calendar · personal" },
    ] satisfies FocusEvent[],
  },

  tasks: {
    meta: "2 / 5 DONE",
    donePct: 0.4,
    today: [
      { title: "Review compliance checklist", sub: "Ops · done 09:42", done: true },
      { title: "Reply to Sarah — 1:1 notes", sub: "Inbox · done 10:38", done: true },
      { title: "Ship Whoop sync fix", sub: "14:00–15:00 · blocked", timeBlocked: true, priority: true },
    ] satisfies FocusTask[],
    week: [
      { title: "Draft Q3 board update", sub: "Strategy · Wed" },
      { title: "Renew domain registrations", sub: "Admin · Thu" },
    ] satisfies FocusTask[],
  },

  habits: [
    {
      name: "Meditate",
      streak: "12-day streak",
      dots: ["done", "done", "done", "done", "done", "done", "today"],
    },
    {
      name: "Read 30 min",
      streak: "5-day streak",
      dots: ["empty", "empty", "done", "done", "done", "done", "today"],
    },
    {
      name: "Cold plunge",
      streak: "Streak reset · 0",
      reset: true,
      dots: ["done", "done", "empty", "empty", "empty", "empty", "today"],
    },
  ] satisfies Habit[],

  journal: {
    prompt: "What pulled your focus today?",
    placeholder: "Tap to write",
    meta: "Last entry yesterday · 6-day streak",
  },
};
