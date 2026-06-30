/**
 * Sample Detail-page content (spec §5.5) — one representative event and one
 * representative task, keyed by `kind`. The tapped row only carries `kind` +
 * `title` (the DetailItem contract); the rich body lives here until the
 * Phase-2 agent + live stores supply it. Mirrors the approved detail-pages
 * mockup. The "Recommended" recs are agent output (spec §6.3) — shown
 * populated by default; the empty/"agent off" state is available in the screen.
 */
import type { Recommendation } from "../components/AIRecommendationsPanel";

export type Attendee = {
  /** 2-letter initials shown in the stacked avatar, or "+N" for the overflow. */
  initials: string;
};

export type Fact = {
  label: string;
  /** Plain value shown on the right. Omit when `attendees` is set. */
  value?: string;
  /** Render this fact as a stacked attendee row instead of a value. */
  attendees?: Attendee[];
  /** Dim the value (mockup `.mut`) for softer, secondary facts. */
  muted?: boolean;
};

export type EmphasisTitle = {
  /** Leading plain text, e.g. "Investor call — ". */
  lead: string;
  /** Italic emphasis word that closes the title, e.g. "Sequoia.". */
  emphasis: string;
};

export type DetailContent = {
  /** Eyebrow type word (e.g. "Event" / "Task") — rendered after a glyph. */
  eyebrowType: string;
  /** Eyebrow source/meta tail (e.g. "Google Calendar" / "Build · High priority"). */
  eyebrowSource: string;
  /** Title split so the emphasis word can render serif-italic. */
  title: EmphasisTitle;
  facts: Fact[];
  /** "About" section meta (e.g. "FROM INVITE" / "YOUR NOTE"). */
  aboutMeta: string;
  about: string;
  recommendations: Recommendation[];
  /** Action-bar pills; first one is the primary (blue) action. */
  actions: string[];
};

const event: DetailContent = {
  eyebrowType: "Event",
  eyebrowSource: "Google Calendar",
  title: { lead: "Investor call — ", emphasis: "Sequoia." },
  facts: [
    { label: "When", value: "Today · 3:00–3:45 PM" },
    { label: "Where", value: "Google Meet", muted: true },
    {
      label: "With",
      attendees: [{ initials: "RB" }, { initials: "TL" }, { initials: "+2" }],
    },
  ],
  aboutMeta: "From invite",
  about:
    "Quarterly check-in with the Sequoia partners. Walking through the pricing-model update, Q3 pipeline, and the hiring plan. Roelof is bringing one new associate.",
  recommendations: [
    {
      text: "You still owe Sequoia the updated pricing deck from last call — it's sitting in drafts.",
      action: "Open draft",
    },
    {
      text: "Pipeline is up 22% since the last update — lead with that, it's your strongest number.",
      action: "View metrics",
    },
    {
      text: "You're free 2:00–3:00 PM — want a 30-min prep block before this?",
      action: "Add prep block",
    },
  ],
  actions: ["Join", "Reschedule", "Notes"],
};

const task: DetailContent = {
  eyebrowType: "Task",
  eyebrowSource: "Build · High priority",
  title: { lead: "Ship Whoop ", emphasis: "sync fix." },
  facts: [
    { label: "When", value: "Today · 2:00–3:00 PM" },
    { label: "Estimate", value: "45 min", muted: true },
    { label: "Project", value: "Pricing model", muted: true },
  ],
  aboutMeta: "Your note",
  about:
    "The Whoop cron occasionally throws on a single user and aborts the whole batch — silent dead syncs. Isolate each user's sync so one failure can't kill the run for everyone else.",
  recommendations: [
    {
      text: "2 sync errors logged 03:14 overnight — same user, almost certainly the root cause.",
      action: "View errors",
    },
    {
      text: "PR #3 touched the cron auth path Tuesday — start there before rewriting the loop.",
      action: "Open PR #3",
    },
    {
      text: "Your 2:00 block fits the 45-min estimate exactly — protect it, you're recovered today.",
    },
  ],
  actions: ["Start", "Complete", "Snooze"],
};

export const detailContent: Record<"event" | "task", DetailContent> = { event, task };
