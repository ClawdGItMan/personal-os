/**
 * Capture sheet static copy (spec §5.6). The live agent conversation itself
 * (messages, tool confirmations, notices) is session state owned by
 * `useCaptureSession` (`components/capture/useCaptureSession.ts`) — this file
 * only holds the fixed chrome copy: header label, empty-state hint, input
 * placeholder, and the quick-intent chips + the text they prefill.
 */
export const captureData = {
  /** Header eyebrow — idle vs. mid-stream (spec §5.6). */
  header: { idle: "Agent", sending: "Thinking" },
  /** Empty-state hint shown before the first exchange this session. */
  intro: "Log anything — workout, expense, task, note.",
  /** Input dock placeholder. */
  placeholder: "Log anything…",
  /** Quick-intent chips (spec §5.6). */
  quickIntents: ["Workout", "Expense", "Task", "Note"] as const,
  /** Text each chip prefills into the input, focused for the user to finish typing. */
  quickIntentPrefill: {
    Workout: "Log workout: ",
    Expense: "Spent $",
    Task: "Task: ",
    Note: "Note: ",
  } as const,
} as const;
