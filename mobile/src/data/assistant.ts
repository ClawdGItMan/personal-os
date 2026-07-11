/**
 * Assistant sheet static config (design README §Assistant sheet, spec 8a).
 * Live content — briefing, top move, also-seeing — now comes from
 * `lib/assistant/api.ts`'s `getBrief()` / `act()` / `streamChat()`; this file
 * only keeps copy that has no live source (brief B6). `SeeingItem` is the
 * ALSO SEEING row's UI shape — `AssistantSheet.tsx` maps the live
 * `AssistantAlsoSeeing` API type onto it (tag/action/tone renamed to match
 * this row grammar) and layers per-row `act()` status on top.
 */

export type SeeingRowStatus = "idle" | "pending" | "success" | "error";

export type SeeingItem = {
  /** Domain tag — FOCUS / MONEY / HABIT / ... (server's `domain`). */
  tag: string;
  title: string;
  sub: string;
  /** Action pill label — BLOCK / VIEW / 7:00 PM / ... (server's `actionLabel`). */
  action: string;
  /** Actionable rows (backed by a tool) render accent; informational rows
   * (no tool — e.g. VIEW, a static time) render neutral. */
  actionTone: "accent" | "neutral";
  tool: string | null;
  args: Record<string, unknown> | null;
  status: SeeingRowStatus;
  errorMessage?: string;
};

export const assistantConfig = {
  suggestions: ["Plan tomorrow", "Where's my money going?", "How's my sleep trending?"],
  askPlaceholder: "Ask anything — I have the full picture",
};
