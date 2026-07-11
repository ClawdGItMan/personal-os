// The classic functional API (`getCalendarsAsync`/`getEventsAsync`/etc. — not
// the SDK 56 class-based `ExpoCalendar` API) lives under the `/legacy`
// subpath; the package root only re-exports the newer class API, which
// doesn't expose the plain `Event` type this file maps from.
import * as Calendar from "expo-calendar/legacy";

import type { EventState } from "../components/EventRow";
import type { CalendarTodayEvent } from "./queries/useCalendarToday";

/**
 * Device calendars (Apple/iCloud/Google/anything synced to the phone) via
 * expo-calendar (EventKit on iOS, CalendarProvider on Android). Read-only —
 * this app never writes to the device calendar. Every function here is
 * guarded: a denied/undetermined permission degrades to an empty result
 * rather than throwing, so callers (the Home timeline merge, a later task)
 * never need a try/catch of their own.
 */

export type DeviceCalendarPermissionStatus = "granted" | "denied" | "undetermined";

export type DeviceCalendarInfo = {
  id: string;
  title: string;
  /** Hex color the OS renders this calendar's events in. */
  color: string;
  /** Account/source name (e.g. "iCloud", "Gmail") — empty string if unknown. */
  source: string;
};

/** A device event mapped to the shape `useCalendarToday`'s `CalendarTodayEvent`
 * consumes, tagged so the Home timeline merge (useQueueRows, a later task) can
 * de-dupe against synced `google_calendar` rows and prefer those. */
export type DeviceCalendarTodayEvent = CalendarTodayEvent & { source: "device" };

/** Local start / end of today as Date objects (expo-calendar's `getEventsAsync`
 * takes Dates, not ISO strings) — same device-local "today" boundary
 * convention as `useCalendarToday`'s `todayBounds`. */
function todayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

/** "HH:MM" in the device's local time. */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** done: ended in the past · now: currently within [start,end] · up: still upcoming.
 * Mirrors `useCalendarToday`'s `deriveState` semantics for a device Event. */
function deriveState(start: Date, end: Date | null, now: number): EventState {
  const startMs = start.getTime();
  const endMs = end ? end.getTime() : null;
  if (endMs !== null && endMs < now) return "done";
  if (startMs <= now && (endMs === null ? startMs === now : now < endMs)) return "now";
  if (endMs === null && startMs < now) return "done";
  return "up";
}

function mapEvent(event: Calendar.Event, now: number): DeviceCalendarTodayEvent {
  const id = `device:${event.id}`;
  const sub = event.location || "";

  // All-day events don't have a meaningful clock time or in-progress state —
  // surface them as a fixed "ALL DAY" label rather than forcing them through
  // the done/now/up derivation.
  if (event.allDay) {
    return { id, time: "ALL DAY", state: "up", title: event.title, sub, source: "device" };
  }

  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : null;
  const state = deriveState(start, end, now);
  return {
    id,
    time: state === "now" ? "NOW" : formatTime(start),
    state,
    title: event.title,
    sub,
    source: "device",
  };
}

/** Ask the user to grant (or resolve already-granted) read access to the
 * device's calendars. Prompts the OS dialog — call from a Settings opt-in
 * flow (a later task), not on mount. */
export async function requestCalendarAccess(): Promise<DeviceCalendarPermissionStatus> {
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "denied";
    const requested = await Calendar.requestCalendarPermissionsAsync();
    return requested.granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Current calendar permission without prompting — safe to call on mount
 * (e.g. to decide whether a Settings screen should show a "grant access"
 * row or the calendar picker). */
export async function getCalendarAccessStatus(): Promise<DeviceCalendarPermissionStatus> {
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (current.granted) return "granted";
    return current.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

/** Every event-entity calendar on the device (Apple/iCloud/Google/anything
 * synced to it). Returns [] without prompting when permission isn't already
 * granted — call `requestCalendarAccess()` first. */
export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (!current.granted) return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map((cal) => ({
      id: cal.id,
      title: cal.title,
      color: cal.color,
      source: cal.source?.name ?? "",
    }));
  } catch {
    return [];
  }
}

/** Today's events from the given device calendars, mapped to the
 * `CalendarTodayEvent` shape (`source: "device"`) for the Home timeline merge
 * (useQueueRows, a later task). Empty selection (feature off) and
 * denied/undetermined permission both degrade to [] — never throws. */
export async function getDeviceEventsToday(calendarIds: string[]): Promise<DeviceCalendarTodayEvent[]> {
  if (calendarIds.length === 0) return [];
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (!current.granted) return [];

    const { start, end } = todayBounds();
    const events = await Calendar.getEventsAsync(calendarIds, start, end);
    // Ascending by start time (all-day events first), matching
    // `useCalendarToday`'s `.order("starts_at", { ascending: true })`.
    const sorted = [...events].sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    const now = Date.now();
    return sorted.map((event) => mapEvent(event, now));
  } catch {
    return [];
  }
}
