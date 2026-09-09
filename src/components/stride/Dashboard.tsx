"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Barbell,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  Flag,
  Heartbeat,
  Lightning,
  PersonSimpleRun,
  Plus,
  Sparkle,
  Target,
  TrendUp,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  addDays,
  runDay,
  dayKey,
  daysBetween,
  formatDay,
  generateWeek,
  goalPace,
  monday,
  pace,
  readiness,
  weekDistance,
} from "@/lib/stride/training";
import type { Run, Session } from "@/lib/stride/types";
import { useStride } from "./Store";
import {
  CoachMark,
  Empty,
  Progress,
  SectionTitle,
  SessionIcon,
  Tag,
} from "./ui";

type Actions = {
  openSession: (session: Session) => void;
  openRun: (run: Run) => void;
  checkin: () => void;
  logRun: () => void;
};
export function Dashboard({ openSession, openRun, checkin, logRun }: Actions) {
  const { state, navigate } = useStride();
  const [chartWeeks, setChartWeeks] = useState(6);
  const today = dayKey();
  const week = generateWeek(state.profile, monday(), state.overrides);
  const current = week.find((s) => s.date === today)!;
  const currentCompleted = state.runs.some((r) => runDay(r) === today);
  const km = weekDistance(state.runs);
  const previousKm = weekDistance(state.runs, addDays(monday(), -7));
  const ready = readiness(state.checkins.find((c) => c.date === today));
  const days = Math.max(0, daysBetween(state.profile.raceDate, today));
  const planKm = week.reduce((sum, session) => sum + session.distance, 0);
  const completedCount = week.filter(
    (s) => s.distance > 0 && state.runs.some((r) => runDay(r) === s.date),
  ).length;
  const weeklyRuns = week.filter((s) => s.distance > 0).length;
  const chart = Array.from({ length: chartWeeks }, (_, i) => {
    const start = addDays(monday(), (i - chartWeeks + 1) * 7);
    return {
      value: weekDistance(state.runs, start),
      label: formatDay(dayKey(start)),
      current: i === chartWeeks - 1,
    };
  });
  const chartMax =
    Math.max(state.profile.weeklyKm, ...chart.map((w) => w.value)) * 1.2;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-sun" />
            YOUR EVERYDAY, A LITTLE STRONGER
          </div>
          <h1>A little closer, every run.</h1>
          <p>
            Welcome back
            {state.profile.name !== "Runner" ? `, ${state.profile.name}` : ""}.
            Let’s make today a good one.
          </p>
        </div>
        <button className="button primary" onClick={logRun}>
          <Plus size={18} />
          Log a run
        </button>
      </div>
      <div className="hero-grid">
        <section className="today-hero">
          <div className="hero-top">
            <span className="eyebrow">
              <span className="status-dot" />
              TODAY’S FOCUS
            </span>
            <Tag tone="white">
              {currentCompleted ? "Run complete" : current.kind}
            </Tag>
          </div>
          <div className="hero-copy">
            <h2>
              {currentCompleted
                ? "Miles in the bank.\nTime to recharge."
                : current.kind === "Long run"
                  ? "Go a little further.\nKeep it feeling easy."
                  : current.kind === "Rest day"
                    ? "Rest is part\nof the rhythm."
                    : current.kind === "Strength"
                      ? "Stronger foundations.\nBetter miles ahead."
                      : "Show up. Settle in.\nFind your stride."}
            </h2>
            <p>
              {currentCompleted
                ? "You showed up. Give your body the recovery it’s earned."
                : current.description.split(".")[0] + "."}
            </p>
          </div>
          <div className="hero-bottom">
            <div className="hero-workout-metrics">
              <div>
                <PersonSimpleRun size={18} />
                <strong>
                  {current.distance
                    ? `${current.distance} km`
                    : current.minutes
                      ? `${current.minutes} min`
                      : "Recovery"}
                </strong>
              </div>
              {current.minutes > 0 && (
                <>
                  <span className="metric-divider" />
                  <div>
                    <Clock size={18} />
                    <span>~{current.minutes} min</span>
                  </div>
                </>
              )}
            </div>
            <button
              className="button dark"
              onClick={() =>
                currentCompleted ? checkin() : openSession(current)
              }
            >
              {currentCompleted ? "Check in" : "View workout"}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <svg
            className="hero-track"
            viewBox="0 0 430 300"
            fill="none"
            aria-hidden="true"
          >
            <g transform="rotate(-30 240 160)">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x={80 - i * 14}
                  y={60 - i * 14}
                  width={310 + i * 28}
                  height={130 + i * 28}
                  rx={65 + i * 14}
                  stroke="#84925e"
                  strokeOpacity={0.3}
                  strokeWidth="1.5"
                />
              ))}
              <path
                d="M127 157a40 40 0 0 1 0-64h177"
                stroke="#758748"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle
                cx="304"
                cy="93"
                r="10"
                fill="#596b37"
                stroke="#e7eddb"
                strokeWidth="5"
              />
            </g>
          </svg>
        </section>
        <section className="race-card">
          <div className="race-shade" />
          <div className="race-card-top">
            <span className="eyebrow">
              <Flag size={14} />
              THE BIG PICTURE
            </span>
            <button
              aria-label="Edit race goal"
              className="race-edit"
              onClick={() => navigate("Settings")}
            >
              <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="race-content">
            <span className="race-count">
              {days}
              <small>days to your starting line</small>
            </span>
            <h2>{state.profile.raceName}</h2>
            <p>
              <CalendarBlank size={14} />
              {formatDay(state.profile.raceDate, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="race-footer">
              <span>
                <Target size={15} />
                Goal <strong>{state.profile.goalTime}</strong>
              </span>
              <button
                onClick={() => navigate("Training plan")}
                aria-label="View race training plan"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className="stats-grid">
        <section className="stat-card">
          <div className="stat-top">
            <span>This week’s distance</span>
            <span className="stat-icon">
              <PersonSimpleRun size={18} />
            </span>
          </div>
          <div className="stat-number">
            {km.toFixed(1)}
            <small>/ {planKm.toFixed(0)} km</small>
          </div>
          <Progress value={km} max={planKm} />
          <p>
            {planKm > km
              ? `${(planKm - km).toFixed(1)} km of possibility ahead`
              : "Your weekly miles are in"}
          </p>
        </section>
        <section className="stat-card">
          <div className="stat-top">
            <span>Weekly consistency</span>
            <span className="stat-icon lavender">
              <CheckCircle size={18} />
            </span>
          </div>
          <div className="stat-number">
            {completedCount}
            <small>/ {weeklyRuns} runs</small>
          </div>
          <div className="consistency-dots">
            {week.map((s) => (
              <span
                key={s.id}
                className={`${s.distance > 0 ? "planned" : ""} ${state.runs.some((r) => runDay(r) === s.date) ? "done" : ""}`}
                title={formatDay(s.date)}
              >
                {state.runs.some((r) => runDay(r) === s.date) ? (
                  <Check size={11} weight="bold" />
                ) : s.date === today ? (
                  <span />
                ) : null}
              </span>
            ))}
          </div>
          <p>Small efforts. Real momentum.</p>
        </section>
        <button className="stat-card actionable" onClick={checkin}>
          <div className="stat-top">
            <span>Daily readiness</span>
            <span className="stat-icon pink">
              <Heartbeat size={18} />
            </span>
          </div>
          <div className="stat-number">
            {ready.score ?? "—"}
            <small>{ready.score !== null ? "/ 100" : "Check in"}</small>
          </div>
          <span
            className={`readiness-label ${ready.score !== null && ready.score < 50 ? "warning" : ""}`}
          >
            <span className="status-dot" />
            {ready.label}
          </span>
          <p>
            Based on your check-in <ArrowUpRight size={12} />
          </p>
        </button>
        <section className="stat-card">
          <div className="stat-top">
            <span>Marathon goal pace</span>
            <span className="stat-icon peach">
              <Target size={18} />
            </span>
          </div>
          <div className="stat-number">
            {goalPace(state.profile)}
            <small>/ km</small>
          </div>
          <span className="goal-caption">
            <Flag size={13} />
            {state.profile.goalTime} finish-time goal
          </span>
          <p>A direction to work toward</p>
        </section>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main-column">
          <section className="panel week-panel">
            <SectionTitle
              title="Your week, at a glance"
              detail={`${formatDay(dayKey(monday()))} – ${formatDay(dayKey(addDays(monday(), 6)))}`}
              action="Training plan"
              onClick={() => navigate("Training plan")}
            />
            <WeekStrip sessions={week} onClick={openSession} />
            <div className="week-bottom">
              <span>
                <span className="legend-dot green" />
                Easy & long runs
              </span>
              <span>
                <span className="legend-dot amber" />
                Speed work
              </span>
              <span>
                <span className="legend-dot violet" />
                Strength
              </span>
              <span className="week-focus">Consistency is the goal.</span>
            </div>
          </section>
          <section className="panel progress-panel">
            <div className="section-title">
              <div>
                <h2>Building your base</h2>
                <p>Your weekly distance, one step at a time</p>
              </div>
              <select
                aria-label="Progress chart range"
                className="small-select"
                value={chartWeeks}
                onChange={(event) => setChartWeeks(Number(event.target.value))}
              >
                <option value={6}>Last 6 weeks</option>
                <option value={4}>Last 4 weeks</option>
              </select>
            </div>
            <div className="chart-summary">
              <strong>
                {state.runs.reduce((sum, r) => sum + r.distance, 0).toFixed(1)}
                <span>km logged</span>
              </strong>
              {previousKm > 0 && (
                <span className="chart-note">
                  <TrendUp size={15} />
                  {previousKm.toFixed(1)} km last week
                </span>
              )}
            </div>
            <div className="bar-chart">
              <div className="chart-y-axis">
                {[1, 0.66, 0.33, 0].map((n) => (
                  <span key={n}>{Math.round(chartMax * n)}</span>
                ))}
              </div>
              <div className="chart-plot">
                <div className="chart-gridlines">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="chart-bars">
                  {chart.map((w) => (
                    <div
                      className={`chart-bar-column ${w.current ? "current" : ""}`}
                      key={w.label}
                    >
                      <div className="chart-bar-space">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(1, (w.value / chartMax) * 100)}%`,
                          }}
                        >
                          <span>{w.value} km</span>
                        </div>
                      </div>
                      <span>{w.current ? "This week" : w.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="panel recent-panel">
            <SectionTitle
              title="The miles you’ve made"
              action="All activities"
              onClick={() => navigate("Activities")}
            />
            {state.runs.length ? (
              <div className="recent-runs">
                {state.runs.slice(0, 3).map((run, i) => (
                  <button
                    key={run.id}
                    className="recent-run"
                    onClick={() => openRun(run)}
                  >
                    <span className={`activity-icon ${i === 1 ? "amber" : ""}`}>
                      <PersonSimpleRun size={23} />
                    </span>
                    <span className="recent-run-title">
                      <strong>{run.title}</strong>
                      <small>
                        {formatDay(runDay(run))} · {run.kind}
                      </small>
                    </span>
                    <span className="recent-run-stat">
                      <strong>
                        {run.distance.toFixed(1)} <small>km</small>
                      </strong>
                      <span>{pace(run)} /km</span>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Your story starts with one run"
                detail="Log a run or connect your activity history."
                action="Log a run"
                onClick={logRun}
              />
            )}
          </section>
        </div>
        <aside className="dashboard-side-column">
          <section className="coach-card">
            <div className="coach-card-heading">
              <CoachMark />
              <div>
                <h3>In your corner.</h3>
                <span>Your Stride coach</span>
              </div>
              <Tag tone="outline">COACH</Tag>
            </div>
            <h2>
              A thoughtful plan.
              <br />A little perspective.
            </h2>
            <p>
              {state.adjustments.some((a) => a.status === "pending")
                ? "Your latest check-in suggests some extra recovery. Let’s look at a small change to your next session."
                : "The best training plan makes room for how you actually feel. Let’s check in and keep moving forward."}
            </p>
            <button className="coach-question" onClick={checkin}>
              <span>How are your legs feeling today?</span>
              <ArrowRight size={17} />
            </button>
            <button
              className="button coach-button"
              onClick={() => navigate("AI coach")}
            >
              <Sparkle size={17} />
              Talk with your coach
              <ArrowUpRight size={16} />
            </button>
            <span className="coach-footnote">
              {state.cloudCoach
                ? "Live AI coaching enabled"
                : "Local coaching preview"}
            </span>
          </section>
          <section className="panel next-up-panel">
            <SectionTitle title="Beyond the miles" />
            <button
              className="beyond-item"
              onClick={() => navigate("Nutrition")}
            >
              <span className="beyond-icon peach">
                <Lightning size={21} />
              </span>
              <span>
                <strong>Fuel the work</strong>
                <small>A plan for your next long run</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <button
              className="beyond-item"
              onClick={() => navigate("Strength & recovery")}
            >
              <span className="beyond-icon lavender">
                <Barbell size={21} />
              </span>
              <span>
                <strong>Strong for the long run</strong>
                <small>25-minute runner’s foundation</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <div className="beyond-tip">
              <span className="small-kicker">A GENTLE REMINDER</span>
              <p>
                Recovery isn’t a break from training. It’s where training takes
                root.
              </p>
            </div>
          </section>
          <button
            className="connect-nudge"
            onClick={() => navigate("Connections")}
          >
            <span className="integration-mini">
              <span className="strava-mini">▲</span>
              <HeartMini />
            </span>
            <div>
              <strong>Your runs, all together.</strong>
              <p>Connect Strava or import Apple Health</p>
            </div>
            <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
    </>
  );
}
function HeartMini() {
  return (
    <span className="health-mini">
      <Heartbeat weight="fill" size={18} />
    </span>
  );
}
export function WeekStrip({
  sessions,
  onClick,
}: {
  sessions: Session[];
  onClick: (session: Session) => void;
}) {
  const { state } = useStride();
  return (
    <div className="week-strip">
      {sessions.map((session) => {
        const completed =
          state.runs.some((r) => runDay(r) === session.date) ||
          (session.kind === "Strength" &&
            state.strength.includes(session.date));
        return (
          <button
            key={session.id}
            className={`day-cell ${session.date === dayKey() ? "today" : ""} ${completed ? "completed" : ""}`}
            onClick={() => onClick(session)}
            aria-label={`${formatDay(session.date, { weekday: "long", month: "short", day: "numeric" })}, ${session.kind}, ${session.distance ? `${session.distance} km` : `${session.minutes} minutes`}${completed ? ", completed" : ""}`}
          >
            <span className="day-name">
              {formatDay(session.date, { weekday: "short" })}
            </span>
            <span className="day-number">
              {formatDay(session.date, { day: "numeric" })}
            </span>
            <span
              className={`day-icon ${session.kind === "Tempo run" ? "amber" : session.kind === "Strength" ? "violet" : session.kind === "Rest day" ? "rest" : ""}`}
            >
              <SessionIcon kind={session.kind} size={21} />
            </span>
            <b>
              {session.distance
                ? `${session.distance} km`
                : session.minutes
                  ? `${session.minutes} min`
                  : "Rest"}
            </b>
            <small>{session.kind.replace(" run", "")}</small>
            <span className="day-status">
              {completed ? (
                <Check size={13} weight="bold" />
              ) : session.date === dayKey() ? (
                "TODAY"
              ) : (
                ""
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TrainingPlan({
  openSession,
}: {
  openSession: (session: Session) => void;
}) {
  const { state, navigate, acceptAdjustment, dismissAdjustment } = useStride();
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(monday(), weekOffset * 7);
  const week = generateWeek(state.profile, start, state.overrides);
  const weekKm = week.reduce((total, session) => total + session.distance, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR ROAD TO 42.2</div>
          <h1>A plan that moves with you.</h1>
          <p>Structure when you need it. Flexibility when life happens.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("Settings")}
        >
          <Target size={17} />
          Edit my goal
        </button>
      </div>
      <div className="plan-layout">
        <div>
          <section className="panel plan-week">
            <div className="section-title">
              <div>
                <span className="small-kicker">
                  {weekOffset === 0
                    ? "THIS WEEK"
                    : weekOffset > 0
                      ? "LOOKING AHEAD"
                      : "YOUR PAST WEEK"}
                </span>
                <h2>
                  {formatDay(dayKey(start))} –{" "}
                  {formatDay(dayKey(addDays(start, 6)))}
                </h2>
                <p>
                  {weekKm.toFixed(1)} km planned ·{" "}
                  {week.filter((s) => s.distance > 0).length} runs
                </p>
              </div>
              <div className="week-controls">
                <button
                  className="icon-button"
                  aria-label="Previous week"
                  disabled={weekOffset <= -16}
                  onClick={() => setWeekOffset((w) => w - 1)}
                >
                  <CaretLeft size={19} />
                </button>
                <button
                  className="button secondary compact"
                  onClick={() => setWeekOffset(0)}
                >
                  Today
                </button>
                <button
                  className="icon-button"
                  aria-label="Next week"
                  disabled={dayKey(addDays(start, 7)) > state.profile.raceDate}
                  onClick={() => setWeekOffset((w) => w + 1)}
                >
                  <CaretRight size={19} />
                </button>
              </div>
            </div>
            <WeekStrip sessions={week} onClick={openSession} />
          </section>
          <div className="plan-sessions">
            {week.map((session) => {
              const completed = state.runs.some(
                (r) => runDay(r) === session.date,
              );
              return (
                <button
                  className={`plan-session ${session.date === dayKey() ? "today" : ""}`}
                  key={session.id}
                  onClick={() => openSession(session)}
                >
                  <div className="plan-session-date">
                    <span>{formatDay(session.date, { weekday: "short" })}</span>
                    <strong>
                      {formatDay(session.date, { day: "numeric" })}
                    </strong>
                  </div>
                  <span
                    className={`session-icon ${session.kind === "Tempo run" ? "amber" : session.kind === "Strength" ? "violet" : ""}`}
                  >
                    <SessionIcon kind={session.kind} size={23} />
                  </span>
                  <div className="plan-session-copy">
                    <div>
                      <h3>{session.title}</h3>
                      {state.overrides[session.id] && <Tag>Adjusted</Tag>}
                    </div>
                    <p>
                      {session.kind} · {session.description.split(".")[0]}
                    </p>
                  </div>
                  <span className="plan-session-distance">
                    {session.distance
                      ? `${session.distance} km`
                      : session.minutes
                        ? `${session.minutes} min`
                        : "—"}
                    {completed && (
                      <small>
                        <Check size={12} />
                        Complete
                      </small>
                    )}
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
        </div>
        <aside>
          <section className="panel plan-goal">
            <span className="goal-flag">
              <Flag size={26} />
            </span>
            <span className="small-kicker">THE REASON YOU SHOW UP</span>
            <h2>{state.profile.raceName}</h2>
            <p>
              {formatDay(state.profile.raceDate, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="goal-values">
              <div>
                <strong>
                  {Math.max(0, daysBetween(state.profile.raceDate, dayKey()))}
                </strong>
                <span>days to go</span>
              </div>
              <div>
                <strong>{state.profile.goalTime}</strong>
                <span>goal finish</span>
              </div>
            </div>
            <Progress
              value={Math.max(
                0,
                112 - daysBetween(state.profile.raceDate, dayKey()),
              )}
              max={112}
            />
            <small>A steady build. An easier taper. Your starting line.</small>
          </section>
          <section className="panel adaptations">
            <div className="section-title">
              <h2>
                <Sparkle size={19} />
                Plan adjustments
              </h2>
            </div>
            {state.adjustments.length ? (
              state.adjustments.slice(0, 5).map((adjustment) => (
                <div className="adjustment" key={adjustment.id}>
                  <Tag
                    tone={adjustment.status === "pending" ? "amber" : "green"}
                  >
                    {adjustment.status === "pending"
                      ? "For your review"
                      : adjustment.status}
                  </Tag>
                  <h3>{adjustment.title}</h3>
                  <p>{adjustment.reason}</p>
                  <div className="adjustment-change">
                    <span>{formatDay(adjustment.sessionDate)}</span>
                    <del>{adjustment.before}</del>
                    <b>
                      {adjustment.after.distance
                        ? `${adjustment.after.distance} km recovery run`
                        : "Rest day"}
                    </b>
                  </div>
                  {adjustment.status === "pending" && (
                    <div className="adjustment-actions">
                      <button
                        className="button primary compact"
                        onClick={() => acceptAdjustment(adjustment.id)}
                      >
                        Apply change
                      </button>
                      <button
                        className="text-button"
                        onClick={() => dismissAdjustment(adjustment.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="adjustment-empty">
                <CheckCircle size={30} />
                <h3>A little room to adapt</h3>
                <p>
                  Log your runs and daily check-ins. When effort, fatigue, or
                  pain suggests a change, it will appear here for your review.
                </p>
              </div>
            )}
          </section>
          <p className="plan-note">
            This is a starter schedule based on your weekly distance and race
            date. It needs your feedback, and is not a substitute for an
            individualized assessment.
          </p>
        </aside>
      </div>
    </>
  );
}
