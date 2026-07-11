/**
 * Assistant sheet content (design README §Assistant sheet, spec 8a) — verbatim
 * copy from the locked spec. mock — assistant backend not built: the real
 * briefing + ranked recommendations are meant to be derived server/LLM-side
 * from all four domain stores (README §State Management).
 */

/** A status-line segment — `{ b }` renders bold at full ink (design README §Assistant, "Recovery's **green**…"). */
export type StatusSegment = string | { b: string };

export type SeeingItem = {
  /** Domain tag — FOCUS / MONEY / HABIT. */
  tag: string;
  title: string;
  sub: string;
  /** Action pill label — BLOCK / VIEW / 7:00 PM. */
  action: string;
  /** BLOCK is accent-outlined; VIEW and 7:00 PM read as neutral outlined pills. */
  actionTone: "accent" | "neutral";
};

export const assistantData = {
  briefing: {
    headline: "You're on pace, Max.",
    body: [
      "Recovery's ",
      { b: "green" },
      ", 3:12 deep hours in, $3.6K left in May. One thing worth moving.",
    ] satisfies StatusSegment[],
  },

  topMove: {
    tag: "TOP MOVE · CAL + BODY",
    title: "Shift tomorrow's training to 4 PM",
    evidence: "SEQUOIA FOLLOW-UP LIKELY 10 AM · HRV TRENDING UP",
  },

  alsoSeeing: [
    {
      tag: "FOCUS",
      title: "Block 30 min to prep the call",
      sub: "BEFORE 3:00 PM",
      action: "BLOCK",
      actionTone: "accent",
    },
    {
      tag: "MONEY",
      title: "AWS is up 18% vs April",
      sub: "−$1,842 YDA",
      action: "VIEW",
      actionTone: "neutral",
    },
    {
      tag: "HABIT",
      title: "Journal streak at risk",
      sub: "2 HABITS LEFT TODAY",
      action: "7:00 PM",
      actionTone: "neutral",
    },
  ] satisfies SeeingItem[],

  suggestions: ["Plan tomorrow", "Where's my money going?", "How's my sleep trending?"],

  askPlaceholder: "Ask anything — I have the full picture",
};
