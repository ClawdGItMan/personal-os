/**
 * Capture sheet content (spec §5.6 + capture-v1/capture-states mockups).
 * All copy/data lives here so the components stay presentational. Replaced by
 * the Phase-2 agent pipeline when it lands (§6.3) — until then these are the
 * deterministic sample exchanges.
 */

/** A lift entry rendered inside a confirmation card via the shared LiftRow. */
export type LiftEntry = {
  kind: "lift";
  name: string;
  scheme: string;
  weight: string;
  unit: string;
  pr: boolean;
};

/** A time-change entry (e.g. a calendar reschedule): old → new. */
export type ChangeEntry = {
  kind: "change";
  title: string;
  sub: string;
  from: string;
  to: string;
};

export type ConfirmationExchange = {
  id: string;
  /** The "YOU · 14:21" eyebrow time. */
  time: string;
  /** The echoed user utterance (Manrope clean). */
  utterance: string;
  /** Card module tag, e.g. "Body · Training". */
  module: string;
  /** Verb shown after the tag, e.g. "logged" / "updated". */
  verb: string;
  /** The parsed entry, rendered in the destination module's row grammar. */
  entry: LiftEntry | ChangeEntry;
  /** One-line agent note. */
  note: string;
  /** Footer chip after Undo — "Edit" or "View". */
  secondary: "edit" | "view";
};

export type PermissionExchange = {
  id: string;
  time: string;
  utterance: string;
  module: string;
  /** Pending (dimmed) change being held until access is granted. */
  pending: ChangeEntry;
  note: string;
  /** Bolded run inside the note (the scope being requested in plain words). */
  noteEmphasis: string;
  grantLabel: string;
  declineLabel: string;
  /** Exact scope named under the actions. */
  scope: string;
};

export const captureData = {
  /** Header eyebrow when idle vs. listening (spec §5.6). */
  header: { idle: "Agent", listening: "Listening" },
  /** Agent intro — Manrope 500, ink50 (spec §5.6). */
  intro: "Tell me what happened — I'll file it where it belongs.",
  /** Input dock placeholder. */
  placeholder: "Log anything…",
  /** Quick-intent chips (degraded, pre-agent state — §6.4). */
  quickIntents: ["Workout", "Expense", "Task", "Note"],

  exchanges: [
    {
      id: "bench",
      time: "1:24 PM",
      utterance: "Benched 185 for 3 by 5, felt strong",
      module: "Body · Training",
      verb: "logged",
      entry: { kind: "lift", name: "Bench Press", scheme: "3 × 5", weight: "185", unit: "lb", pr: true },
      note: "Logged to today's push session — and that's a 5 lb PR on bench. New PR.",
      secondary: "edit",
    },
    {
      id: "lunch",
      time: "1:25 PM",
      utterance: "Push lunch with Adam to 1",
      module: "Focus · Calendar",
      verb: "updated",
      entry: { kind: "change", title: "Lunch · Adam", sub: "Cipriani", from: "12:30 PM", to: "1:00 PM" },
      note: "Moved in Google Calendar. Adam will get the updated invite.",
      secondary: "view",
    },
  ] satisfies ConfirmationExchange[],

  /** The write-back permission gate (capture-states, right panel). */
  permission: {
    id: "perm-lunch",
    time: "1:25 PM",
    utterance: "Push lunch with Adam to 1",
    module: "Focus · Calendar",
    pending: { kind: "change", title: "Lunch · Adam", sub: "Pending change", from: "12:30 PM", to: "1:00 PM" },
    note: "I can move this for you — but I can only read your Google Calendar right now. Editing events needs write access.",
    noteEmphasis: "read",
    grantLabel: "Grant calendar edit",
    declineLabel: "Not now",
    scope: "One-time · Google · calendar.events",
  } satisfies PermissionExchange,

  /** Voice / dictation Listening state (capture-states, left panel). */
  voice: {
    status: "Listening…",
    /** Committed (final) transcript — ink72. */
    committed: "Bench, three by five at one eighty five —",
    /** In-flight (pending) transcript — ink38 + accent caret. */
    pending: " last set was a grind",
    cancel: "Cancel",
    keyboard: "Keyboard",
  },
} as const;
