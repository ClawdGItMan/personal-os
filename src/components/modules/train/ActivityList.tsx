export type ActivityWorkout = {
  sport: string;
  started_at: string;
  duration_sec: number | null;
  strain: number | null;
  avg_hr: number | null;
};

/**
 * Formats a workout's start time in the operator's timezone.
 * Falls back to UTC if the timezone string is invalid (so a bad
 * `profiles.timezone` never throws).
 */
function formatWhen(started_at: string, timeZone: string): string {
  const date = new Date(started_at);

  const fmt = (options: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);
    } catch {
      return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);
    }
  };

  const day = fmt({ weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return `${day} · ${fmt({ hour: "numeric", minute: "2-digit" })}`;
}

export function ActivityList({
  workouts,
  timeZone,
}: {
  workouts: ActivityWorkout[];
  timeZone: string;
}) {
  return (
    <div>
      {workouts.map((workout, i) => {
        const strain = workout.strain !== null ? Number(workout.strain) : null;
        const avgHr = workout.avg_hr !== null ? Number(workout.avg_hr) : null;
        const durationMin =
          workout.duration_sec !== null
            ? Math.round(Number(workout.duration_sec) / 60)
            : null;

        const strainValid = strain !== null && Number.isFinite(strain);
        const avgHrValid = avgHr !== null && Number.isFinite(avgHr);
        const durationValid = durationMin !== null && Number.isFinite(durationMin);

        const metricParts: string[] = [];
        if (strainValid) metricParts.push(`STRAIN ${strain!.toFixed(1)}`);
        if (avgHrValid) metricParts.push(`${Math.round(avgHr!)} BPM`);
        const metricsLine = metricParts.join(" · ");

        return (
          <div
            key={`${workout.started_at}-${i}`}
            className="grid grid-cols-[1fr_auto] gap-3 items-center py-2.5 border-t border-[color:var(--os-line-1)] first:border-t-0"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-[color:var(--os-fg-1)]">
                {workout.sport.toUpperCase()}
              </div>
              {metricsLine && (
                <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--os-fg-4)]">
                  {metricsLine}
                </div>
              )}
            </div>
            <div className="whitespace-nowrap text-right font-mono os-tnum text-[11px] text-[color:var(--os-fg-3)]">
              <div>{formatWhen(workout.started_at, timeZone)}</div>
              {durationValid && <div>{durationMin} MIN</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
