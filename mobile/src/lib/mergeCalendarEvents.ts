/**
 * De-dupe logic for merging device-calendar events (task C-platform's
 * `deviceCalendar.ts` / `queries/useDeviceCalendar.ts`) into the queue/
 * timeline rows built from Supabase's `calendar_events` (useCalendarToday,
 * consumed by `useQueueRows.ts`). Kept as a plain, dependency-free pure
 * function — no React, no Supabase client, no expo-calendar import — so
 * it's trivially unit-testable in isolation and reusable outside
 * useQueueRows.ts.
 *
 * Rationale: a device calendar (EventKit/CalendarProvider) commonly already
 * contains the SAME events this app's own `google_calendar` sync wrote into
 * Supabase — e.g. the user's Google account is also added to the iOS
 * Calendar app, so the same meeting shows up twice once device calendars are
 * opted into. Without de-duping, every synced event would double. We keep
 * the Supabase copy — it's richer (a stable `calendar_events` UUID
 * DetailScreen can look up, plus `external_id`/`source` driving the "Open in
 * Calendar" action) — and drop the matching device copy.
 */

/** Minimal shape a Supabase calendar row needs for de-dupe matching.
 * `CalendarTodayEvent` (useCalendarToday's display-mapped shape) doesn't
 * carry `all_day` — callers must look it up from the raw `calendar_events`
 * row separately (see useQueueRows.ts's `eventsById`). */
export type SupabaseDedupeEvent = {
  title: string;
  /** "HH:MM" 24h, or the literal "NOW". */
  time: string;
  allDay: boolean;
};

/** Minimal shape a device event needs for de-dupe matching — satisfied by
 * `DeviceCalendarTodayEvent` (deviceCalendar.ts) as-is. All-day-ness is read
 * off the literal `time === "ALL DAY"` encoding that lib already uses, not a
 * separate field, so any object with `title`/`time` works — generic `T` lets
 * the caller's full row shape (with `id`/`state`/`sub`/`source`, etc.) pass
 * through untouched. */
type DedupeCandidate = {
  title: string;
  time: string;
};

const DEDUPE_WINDOW_MINUTES = 2;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** "HH:MM" (or "NOW", resolved against `nowMs`) → minutes since local
 * midnight. Returns null for anything else ("ALL DAY", malformed) — callers
 * must treat null as "can't compare", never as 0. */
function toMinutesOfDay(time: string, nowMs: number): number | null {
  if (time === "NOW") {
    const now = new Date(nowMs);
    return now.getHours() * 60 + now.getMinutes();
  }
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Filters `deviceEvents` down to the ones that should actually appear
 * alongside `supabaseEvents` in a merged timeline — drops any device event
 * that's a probable duplicate of a Supabase row.
 *
 * Matching rule: same title (case-insensitive, trimmed) AND, for timed
 * events, |start delta| < 2 minutes.
 *
 * Edge cases (documented per task brief):
 * - **All-day device events** are compared only against all-day Supabase
 *   events — same-day is already guaranteed (both queries are bounded to
 *   "today"), so no time delta applies; a same-title ALL-DAY Supabase event
 *   suppresses the device duplicate. A *timed* Supabase event that happens
 *   to share a title does NOT suppress an all-day device event — e.g. an
 *   all-day "Max's Birthday" device entry and an unrelated timed Supabase
 *   event with a coincidentally matching title are treated as distinct.
 * - **"NOW" events** resolve to the current clock minute (`nowMs`) rather
 *   than being treated as unparseable — two same-titled events both
 *   currently in progress are overwhelmingly likely to be the same
 *   real-world event, independently derived as "now" by each source.
 * - A device event whose time can't be parsed at all (defensive — shouldn't
 *   happen given deviceCalendar.ts's own output) is never suppressed: with
 *   nothing to compare, we err on showing it rather than silently dropping
 *   a real event.
 * - A device event with a title that doesn't match anything in
 *   `supabaseEvents` (the common case — most device events aren't also
 *   synced to Supabase) always survives untouched.
 */
export function dedupeDeviceEvents<T extends DedupeCandidate>(
  supabaseEvents: SupabaseDedupeEvent[],
  deviceEvents: T[],
  nowMs: number,
): T[] {
  return deviceEvents.filter((device) => {
    const deviceTitle = normalizeTitle(device.title);

    if (device.time === "ALL DAY") {
      const isDuplicate = supabaseEvents.some((sb) => sb.allDay && normalizeTitle(sb.title) === deviceTitle);
      return !isDuplicate;
    }

    const deviceMinutes = toMinutesOfDay(device.time, nowMs);
    if (deviceMinutes === null) return true;

    const isDuplicate = supabaseEvents.some((sb) => {
      if (sb.allDay) return false;
      if (normalizeTitle(sb.title) !== deviceTitle) return false;
      const sbMinutes = toMinutesOfDay(sb.time, nowMs);
      if (sbMinutes === null) return false;
      return Math.abs(sbMinutes - deviceMinutes) < DEDUPE_WINDOW_MINUTES;
    });
    return !isDuplicate;
  });
}
