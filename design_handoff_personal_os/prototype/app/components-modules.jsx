// Dashboard modules: Operator, Session, Finance, Tasks, Habits, Calendar,
// Nutrition, Health, Social, Workout
//
// All consume window.MOS_DATA and shared helpers (Card, Sparkline, useClock, etc).

const { useState: useS2, useMemo: useM2 } = React;

// =========================================================
// 01 OPERATOR
// =========================================================
function OperatorCard({ data, onOpen }) {
  return (
    <Card num="01" title="OPERATOR" meta={<span className="op-online">ONLINE</span>}>
      <div className="op-row">
        <div className="op-avatar">{data.initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="op-name">
            {data.name} <em>{data.last}</em>
          </div>
          <div className="op-sub">
            {data.role} · {data.location}
          </div>
        </div>
      </div>
      <div className="op-stats">
        <div>
          <div className="op-stat__label">Focus</div>
          <div className="op-stat__value">{data.focus}</div>
        </div>
        <div>
          <div className="op-stat__label">Streak</div>
          <div className="op-stat__value op-stat__value--num">
            {data.streak}<span>days</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =========================================================
// 02 SESSION — greeting, clock, capture bar
// =========================================================
function SessionCard({ operator, onCapture }) {
  const now = useClock();
  const [val, setVal] = useS2("");
  const hour = now.getHours();
  const greet =
    hour < 5 ? "Still up" :
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 21 ? "Good evening" : "Late night";
  const dayStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const submit = (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    onCapture(val.trim());
    setVal("");
  };

  return (
    <div className="os-card session">
      <div className="session__head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="os-card__num">02 //</span>
          <span className="os-card__title">SESSION</span>
        </div>
        <div className="os-card__meta">
          <span>NEW YORK · UTC-4</span>
        </div>
      </div>
      <div className="session__body">
        <div>
          <div className="session__greet">
            {greet}, <em>{operator.name}.</em>
          </div>
          <div className="session__date">{dayStr.toUpperCase()}</div>
        </div>
        <div className="session__clock">
          <div className="session__time">
            <span>{hh}</span>
            <span className="sep">:</span>
            <span>{mm}</span>
            <span className="secs">{ss}</span>
          </div>
          <div className="session__local">LOCAL TIME</div>
        </div>
      </div>
      <form className="session__capture" onSubmit={submit}>
        <span className="session__capture__kbd">⌘ K</span>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Capture — log a meal, log a lift, note an idea, ask the agent…"
        />
        <button type="submit" className="session__capture__btn">
          ↗ Capture
        </button>
      </form>
    </div>
  );
}

// =========================================================
// 03 FINANCE PULSE
// =========================================================
function FinancePulse({ data, onOpen }) {
  return (
    <Card
      num="03"
      title="FINANCE PULSE"
      meta={
        <button
          onClick={onOpen}
          style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--os-fg-4)" }}
        >
          DETAIL <span style={{ fontSize: 10 }}>↗</span>
        </button>
      }
    >
      <div>
        <div className="os-mono" style={{ marginBottom: 4 }}>Net worth</div>
        <div className="fin-headline">
          <div className="fin-networth">{fmtUSD(data.netWorth)}</div>
          <div className="fin-change">↑ {fmtPct(data.change30d)} · 30D</div>
        </div>
      </div>
      <Sparkline points={data.spark} height={56} />
      <div className="fin-grid">
        <div className="fin-stat">
          <div className="fin-stat__label">Daily</div>
          <div className="fin-stat__value">{fmtUSDDelta(data.daily)}</div>
          <div className="fin-stat__sub">+{data.dailyPct.toFixed(2)}%</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat__label">Monthly</div>
          <div className="fin-stat__value">{fmtUSDDelta(data.monthly)}</div>
          <div className="fin-stat__sub">+{data.monthlyPct.toFixed(2)}%</div>
        </div>
      </div>
    </Card>
  );
}

// =========================================================
// 04 TODAY · KEY tasks
// =========================================================
function TasksCard({ tasks, onToggle }) {
  const remaining = tasks.filter((t) => !t.done && t.star).length;
  return (
    <Card
      num="04"
      title={<span>TODAY · KEY</span>}
      meta={<span style={{ color: "var(--os-honey)" }}>★ {remaining}</span>}
    >
      <div className="tasks">
        {tasks.map((t) => (
          <div
            key={t.id}
            className={`task ${t.done ? "task--done" : ""}`}
            onClick={() => onToggle(t.id)}
          >
            <div className={`task__check ${t.done ? "task__check--done" : ""}`} />
            <div className="task__body">
              <div className="task__title">{t.title}</div>
              <div className="task__tags">
                {t.tags.map((tag) => (
                  <span key={tag} className="task__tag">{tag}</span>
                ))}
              </div>
            </div>
            {t.star && <span className="task__star">★</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// =========================================================
// 05 HABITS
// =========================================================
function HabitsCard({ habits, onToggle }) {
  const done = habits.filter((h) => h.done).length;
  const pct = Math.round((done / habits.length) * 100);
  return (
    <Card
      num="05"
      title="HABITS"
      meta={<span><span style={{ color: "var(--os-fg-1)" }}>{done}/{habits.length}</span> · {pct}%</span>}
    >
      <div className="habits-head">
        <div className="habits-score">{done}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="os-mono" style={{ marginBottom: 6 }}>
            DAILY SCORE · RESETS 00:00
          </div>
          <div className="habits-bar">
            {Array.from({ length: 48 }).map((_, i) => {
              const filled = i < Math.round((done / habits.length) * 48);
              return (
                <div
                  key={i}
                  className={`habits-bar__pip ${filled ? "habits-bar__pip--filled" : ""}`}
                  style={{ height: 4 + ((i * 37) % 16) }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="habits-grid">
        {habits.map((h) => (
          <button
            key={h.id}
            className={`habit ${h.done ? "habit--done" : ""}`}
            onClick={() => onToggle(h.id)}
          >
            <span className="habit__streak">
              <span style={{ color: "var(--os-honey)" }}>♨</span> {h.streak}
            </span>
            <div className="habit__row">
              <div className={`habit__check`} />
              <div className="habit__name">{h.name}</div>
            </div>
            <div className="habit__sub">{h.sub}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

// =========================================================
// 06 CALENDAR
// =========================================================
function CalendarCard({ cal }) {
  // Group events by section (NOW / MORNING / EVENING)
  const grouped = useM2(() => {
    const groups = [];
    let cur = null;
    cal.events.forEach((e) => {
      if (e.section) {
        cur = { label: e.section, now: !!e.now, events: [] };
        groups.push(cur);
      }
      if (!cur) {
        cur = { label: null, events: [] };
        groups.push(cur);
      }
      cur.events.push(e);
    });
    return groups;
  }, [cal]);

  return (
    <Card num="06" title="CALENDAR" meta={<span>{cal.month} · {cal.events.length} EVENTS</span>}>
      <div className="cal-week">
        {cal.week.map((d) => (
          <button
            key={d.dow + d.num}
            className={`cal-day ${d.today ? "cal-day--today" : ""} ${d.active ? "cal-day--active" : ""} ${d.has ? "cal-day--has" : ""}`}
          >
            <div className="cal-day__dow">{d.dow}</div>
            <div className="cal-day__num">{String(d.num).padStart(2, "0")}</div>
            <div className="cal-day__dot" />
          </button>
        ))}
      </div>
      <div className="cal-list">
        {grouped.map((g, gi) => (
          <React.Fragment key={gi}>
            {g.label && (
              <div className={`cal-section-label`} style={g.now ? { color: "var(--os-accent)" } : {}}>
                <span>{g.label}</span>
                <span className="cal-section-label__bar" />
              </div>
            )}
            {g.events.map((e, ei) => (
              <div key={ei} className="cal-event">
                <div className={`cal-event__time ${e.now ? "cal-event__time--now" : ""}`}>
                  {e.time}
                </div>
                <div>
                  <div className="cal-event__title">{e.title}</div>
                  <div className="cal-event__sub">{e.sub}</div>
                </div>
                <div className="cal-event__loc">{e.loc}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

// =========================================================
// 07 NUTRITION (compact)
// =========================================================
function NutritionCard({ n }) {
  const pct = Math.round((n.kcal / n.kcalGoal) * 100);
  return (
    <Card num="07" title="NUTRITION" meta="TODAY">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="ring" style={{ "--pct": pct }}>
          <div className="ring__inner">{pct}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="kpi-big">
            {n.kcal.toLocaleString()}<span className="kpi-big__unit">kcal</span>
          </div>
          <div className="os-mono" style={{ marginTop: 4 }}>
            of {n.kcalGoal.toLocaleString()} · {n.kcalGoal - n.kcal} left
          </div>
        </div>
      </div>
      <div className="kpi-row">
        <div className="kpi-row__item">
          <div className="kpi-row__num kpi-row__num--accent">{n.protein}g</div>
          <div className="kpi-row__lab">Protein</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num">{n.carbs}g</div>
          <div className="kpi-row__lab">Carbs</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num">{n.fat}g</div>
          <div className="kpi-row__lab">Fat</div>
        </div>
      </div>
    </Card>
  );
}

// =========================================================
// 08 HEALTH (compact)
// =========================================================
function HealthCard({ h }) {
  return (
    <Card num="08" title="HEALTH" meta="LAST NIGHT">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="ring" style={{ "--pct": h.recovery, "--c": "var(--os-accent)" }}>
          <div className="ring__inner">{h.recovery}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="kpi-big">{h.sleepHrs}</div>
          <div className="os-mono" style={{ marginTop: 4 }}>
            Sleep · score {h.sleepScore}
          </div>
        </div>
      </div>
      <div className="kpi-row">
        <div className="kpi-row__item">
          <div className="kpi-row__num">{h.hrv}<span style={{fontSize: 9, opacity: 0.5, marginLeft: 2}}>ms</span></div>
          <div className="kpi-row__lab">HRV</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num">{h.rhr}<span style={{fontSize: 9, opacity: 0.5, marginLeft: 2}}>bpm</span></div>
          <div className="kpi-row__lab">RHR</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num kpi-row__num--accent">{h.strain}</div>
          <div className="kpi-row__lab">Strain</div>
        </div>
      </div>
    </Card>
  );
}

// =========================================================
// 09 SOCIAL (compact)
// =========================================================
function SocialCard({ social }) {
  return (
    <Card num="09" title="SOCIAL" meta="REACH · 7D">
      <div className="kpi-big" style={{ fontSize: 22 }}>
        {social.reduce((a, s) => a + parseInt(s.count.replace(/,/g, ""), 10), 0).toLocaleString()}
        <span className="kpi-big__unit">followers</span>
      </div>
      <div className="sparkbars">
        {[6,9,8,12,15,11,14,17,15,19,22,28,24,30,33,29,35,38,42,48,46,51,55,60,58,65].map((v, i) => (
          <div
            key={i}
            className={`sparkbars__bar ${i > 18 ? "sparkbars__bar--accent" : ""}`}
            style={{ height: `${(v / 65) * 100}%` }}
          />
        ))}
      </div>
      <div>
        {social.map((s) => (
          <div key={s.plat} className="social-row">
            <div className="social-row__plat">{s.plat}</div>
            <div className="social-row__count">{s.count}</div>
            <div className="social-row__delta">{s.delta}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// =========================================================
// 10 TRAINING (compact)
// =========================================================
function TrainCard({ w }) {
  return (
    <Card num="10" title="TRAINING" meta={<span>{w.week}</span>}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="kpi-big" style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: "-0.02em" }}>
            {w.name}
          </div>
          <div className="os-mono" style={{ marginTop: 4 }}>NEXT · 18:30 · EQUINOX 19TH</div>
        </div>
        <div className="pill pill--accent">↑ NEW PR</div>
      </div>
      <div className="kpi-row" style={{ gap: 20 }}>
        <div className="kpi-row__item">
          <div className="kpi-row__num kpi-row__num--accent">265 lb</div>
          <div className="kpi-row__lab">Bench · 3RM</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num">14.6</div>
          <div className="kpi-row__lab">Strain</div>
        </div>
        <div className="kpi-row__item">
          <div className="kpi-row__num">5 / 6</div>
          <div className="kpi-row__lab">Sessions · wk</div>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, {
  OperatorCard, SessionCard, FinancePulse, TasksCard,
  HabitsCard, CalendarCard, NutritionCard, HealthCard,
  SocialCard, TrainCard,
});
