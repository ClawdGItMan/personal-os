/**
 * Google Calendar REST helpers.
 *
 * - `fetchEvents` performs a paginated GET against the Calendar v3
 *   `events.list` endpoint (https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
 *   with `singleEvents=true` + `orderBy=startTime` so recurring events are
 *   expanded into individual instances in ascending start-time order.
 * - `mapEvent` converts a raw API event into a `calendar_events` row shape
 *   (see supabase/migrations/20260527120004_create_calendar_events.sql).
 *
 * This is a thin HTTP/transform layer: it never touches Supabase or tokens
 * directly. Callers (the sync core) supply a valid access token and persist
 * the mapped rows.
 */

const EVENTS_LIST_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** A single event as returned by the Calendar v3 `events.list` API. */
export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
}

/**
 * Event start/end. Timed events use `dateTime` (RFC3339); all-day events use
 * `date` (`YYYY-MM-DD`). Cancelled events may carry an empty object.
 */
export interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

/** A row ready to upsert into `public.calendar_events` (sans `user_id`). */
export interface CalendarEventRow {
  external_id: string;
  title: string;
  sub: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  source: "google_calendar";
}

export interface FetchEventsWindow {
  timeMin: string;
  timeMax: string;
}

/**
 * Maps a raw Google Calendar event to a `calendar_events` row.
 *
 * Returns `null` for cancelled events (the caller drops these). All-day events
 * (which carry `start.date`, not `start.dateTime`) are flagged `all_day=true`
 * and normalised to a midnight-UTC timestamp (`YYYY-MM-DDT00:00:00Z`).
 */
export function mapEvent(event: GoogleCalendarEvent): CalendarEventRow | null {
  if (event.status === "cancelled") return null;

  const allDay = Boolean(event.start?.date);

  return {
    external_id: event.id,
    title: event.summary?.trim() ? event.summary : "(no title)",
    sub: shortSub(event.description),
    location: event.location ?? "",
    starts_at: toTimestamp(event.start),
    ends_at: event.end ? toTimestamp(event.end) : null,
    all_day: allDay,
    source: "google_calendar",
  };
}

/**
 * Bounds the event description used as the row subtitle: the `sub` column is a
 * short one-liner, but a Google event description can be many KB of notes/HTML.
 * Collapse whitespace and cap at 140 chars so the Calendar module stays tidy and
 * rows don't bloat.
 */
function shortSub(description: string | undefined): string {
  if (!description) return "";
  return description.replace(/\s+/g, " ").trim().slice(0, 140);
}

/** Normalises an event date/dateTime to an ISO timestamp string. */
function toTimestamp(dt: GoogleEventDateTime | undefined): string {
  if (dt?.dateTime) return dt.dateTime;
  // All-day events carry only a `date` (YYYY-MM-DD); store as midnight UTC.
  if (dt?.date) return `${dt.date}T00:00:00Z`;
  // Cancelled/edge events with no start fall back to epoch; callers drop
  // cancelled events before this is ever surfaced.
  return new Date(0).toISOString();
}

/**
 * Fetches all events in `[timeMin, timeMax)` from the user's primary calendar,
 * following `nextPageToken` until exhausted. Returns the raw API events; the
 * caller maps + filters them via `mapEvent`.
 *
 * @throws on a non-OK HTTP response (the 401 → refresh retry is handled by the
 *   sync core, which inspects the thrown status).
 */
export async function fetchEvents(
  accessToken: string,
  { timeMin, timeMax }: FetchEventsWindow,
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${EVENTS_LIST_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      // Cap the upstream body: it lands in `error_events.message` / the
      // user-facing `integrations.last_error`, so keep it short.
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new GoogleCalendarError(
        `Calendar events.list failed: ${res.status} ${res.statusText} ${body}`.trim(),
        res.status,
      );
    }

    const data = (await res.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
    };
    if (data.items?.length) events.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

/** Error carrying the HTTP status so the sync core can branch on 401. */
export class GoogleCalendarError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
  }
}
