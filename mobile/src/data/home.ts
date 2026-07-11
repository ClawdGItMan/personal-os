import type { StatusSegment } from "../components/spec/TitleBlock";
import { time12 } from "../lib/format";
import type { CalendarTodayEvent, NetWorthPoint } from "../lib/queries";

/**
 * Home mock/fallback data + pure helpers (design README §Home). Task B5 took
 * the FOCUS band, status line, TODAY ledger, and NET WORTH stat live — see
 * HomeScreen.tsx (wires useFocusSessions/useCalendarToday/useQueueRows/
 * useMoney) and useQueueRows.ts (TODAY ledger row-building, mode
 * "today-all"). What's left here: the recovery/HRV/sleep/habits mock
 * FALLBACK values HomeScreen merges over live Whoop/habit data when a field
 * is null (that merge pattern predates this task and stays as-is — "already
 * live"), the greeting/day-progress/hour-split helpers every render still
 * needs, and the new pure helpers this task added for the FOCUS band's NEXT
 * state, the status line's deterministic fallback, the TODAY ledger's header
 * meta, and the NET WORTH stat's 30-day change — colocated here (not React,
 * not the screen) so they stay independently testable, matching data/focus.ts's
 * convention.
 */

export const homeData = {
  recovery: { score: 72 },
  hrv: { ms: 64, restHr: 48 },
  vitals: {
    sleep: { hours: "7", minutes: "12", sub: "87% QUAL" },
    habits: { done: 4, total: 6 },
  },
};

/** Day progress 0–100 through the 6:00–23:00 wake window (design README §Home). */
export function dayProgressPct(d: Date = new Date()): number {
  const wakeMin = 6 * 60;
  const sleepMin = 23 * 60;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const pct = ((minutes - wakeMin) / (sleepMin - wakeMin)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Greeting lead by time of day (design README §Home: morning/afternoon/evening). */
export function greetingLead(d: Date = new Date()): string {
  const hour = d.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Split decimal hours (7.2) into whole hours + zero-padded minutes ("7", "12") for the sleep vital. */
export function splitHours(decimalHours: number): { hours: string; minutes: string } {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

// --- FOCUS band NEXT-state + status-line fallback (pure) ---

export type UpcomingEvent = { title: string; targetMs: number };

/**
 * The earliest "up" (not yet started) event today, or null. `events` is
 * `useCalendarToday`'s query order (ascending by `starts_at`), so the first
 * match is the soonest one. Reconstructs the target Date by parsing the
 * display `HH:MM` back onto today's date, since `CalendarTodayEvent` doesn't
 * carry the raw `starts_at` (only useQueueRows.ts's raw-row fetch does, for
 * Detail — this stays a display-field-only read since it's just for the
 * FOCUS band / status line, not a Detail payload).
 */
export function firstUpcomingEvent(events: CalendarTodayEvent[], nowMs: number): UpcomingEvent | null {
  const now = new Date(nowMs);
  for (const ev of events) {
    if (ev.state !== "up") continue;
    const match = /^(\d{2}):(\d{2})$/.exec(ev.time);
    if (!match) continue;
    const targetMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(match[1]),
      Number(match[2]),
    ).getTime();
    return { title: ev.title, targetMs };
  }
  return null;
}

const NEXT_EVENT_WINDOW_MIN = 8 * 60;
const NEXT_EVENT_RELATIVE_CUTOFF_MIN = 90;

/**
 * FOCUS band's NEXT-state content (no active session, an event starts within
 * 8h) — null when there's no upcoming event or it's further than 8h out (the
 * band falls back to START). Sub reads "IN {m} MIN · {time}" within 90min of
 * start, else "AT {time}".
 */
export function nextFocusBandContent(upcoming: UpcomingEvent | null, nowMs: number): { title: string; sub: string } | null {
  if (!upcoming) return null;
  const minutesUntil = Math.round((upcoming.targetMs - nowMs) / 60000);
  if (minutesUntil < 0 || minutesUntil > NEXT_EVENT_WINDOW_MIN) return null;
  const time = time12(new Date(upcoming.targetMs));
  const sub = minutesUntil <= NEXT_EVENT_RELATIVE_CUTOFF_MIN ? `IN ${minutesUntil} MIN · ${time}` : `AT ${time}`;
  return { title: upcoming.title, sub };
}

/** Recovery-score state word for the status line (spec: green ≥67, red <34, else amber). */
export function recoveryWord(score: number): "green" | "amber" | "red" {
  if (score >= 67) return "green";
  if (score >= 34) return "amber";
  return "red";
}

/**
 * Deterministic status-line fallback, used when no fresh assistant brief is
 * available: "Recovery's {word} and your next block is {event} at {time}."
 * — the second clause is omitted when there's no upcoming event today.
 */
export function fallbackStatusSegments(recoveryScore: number, upcoming: UpcomingEvent | null): StatusSegment[] {
  const word = recoveryWord(recoveryScore);
  if (!upcoming) return ["Recovery's ", { b: word }, "."];
  const time = time12(new Date(upcoming.targetMs));
  return ["Recovery's ", { b: word }, " and your next block is ", { b: upcoming.title }, ` at ${time}.`];
}

/** TODAY ledger header meta, e.g. "6 EVENTS · 2 DONE" — calendar events only
 * (matches the design mock's literal "N EVENTS" wording; tasks aren't counted). */
export function todayMetaLabel(events: CalendarTodayEvent[]): string {
  const done = events.filter((e) => e.state === "done").length;
  return `${events.length} EVENT${events.length === 1 ? "" : "S"} · ${done} DONE`;
}

// --- NET WORTH stat (pure) ---

/** % change from the first to the last point of a net-worth series, or null
 * when there isn't enough history to compute one (< 2 points, or the first
 * point is 0 — avoids a div-by-zero/misleading spike). */
export function netWorthChangePct(series: NetWorthPoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0].value;
  if (first === 0) return null;
  const last = series[series.length - 1].value;
  return ((last - first) / Math.abs(first)) * 100;
}

/** "{±pct}% · 30D", e.g. "+0.03% · 30D" / "-1.20% · 30D". */
export function formatNetWorthPctLabel(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% · 30D`;
}

const BRIEF_FRESH_MS = 12 * 60 * 60 * 1000;

/** Whether an assistant brief's `generated_at` is fresh enough to trust for
 * the status line (spec: <12h old). */
export function isBriefFresh(generatedAt: string | null, nowMs: number): boolean {
  if (!generatedAt) return false;
  return nowMs - new Date(generatedAt).getTime() < BRIEF_FRESH_MS;
}
