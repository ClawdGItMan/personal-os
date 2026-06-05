export type CalendarListEvent = {
  title: string;
  location: string;
  starts_at: string;
  all_day: boolean;
};

/**
 * Formats an event's start in the operator's timezone. All-day events show the
 * date + "ALL DAY"; timed events show weekday + local time. Falls back to UTC if
 * the timezone string is invalid (so a bad `profiles.timezone` never throws).
 */
function formatWhen(event: CalendarListEvent, timeZone: string): string {
  const date = new Date(event.starts_at);

  const fmt = (options: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);
    }
  };

  const day = fmt({ weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  if (event.all_day) return `${day} · ALL DAY`;
  return `${day} · ${fmt({ hour: "numeric", minute: "2-digit" })}`;
}

export function CalendarList({
  events,
  timeZone,
}: {
  events: CalendarListEvent[];
  timeZone: string;
}) {
  return (
    <div>
      {events.map((event, i) => (
        <div
          key={`${event.starts_at}-${i}`}
          className="grid grid-cols-[1fr_auto] gap-3 items-center py-2.5 border-t border-[color:var(--os-line-1)] first:border-t-0"
        >
          <div className="min-w-0">
            <div className="truncate text-sm text-[color:var(--os-fg-1)]">{event.title}</div>
            {event.location && (
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
                {event.location}
              </div>
            )}
          </div>
          <div className="whitespace-nowrap text-right font-mono os-tnum text-[11px] text-[color:var(--os-fg-3)]">
            {formatWhen(event, timeZone)}
          </div>
        </div>
      ))}
    </div>
  );
}
