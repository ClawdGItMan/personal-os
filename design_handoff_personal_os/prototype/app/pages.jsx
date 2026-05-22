// Secondary full pages: FINANCE, HEALTH, TRAIN, SOCIAL, JOURNAL

const { useState: useP1 } = React;

// =========================================================
// FINANCE PAGE
// =========================================================
function FinancePage({ data }) {
  const total = data.accounts.reduce((a, b) => a + b.value, 0);
  return (
    <div className="page">
      <div>
        <div className="page__title">
          Net worth · <em>{fmtUSD(total)}</em>
        </div>
        <div className="page__sub">FINANCE · MAY 2026 · +8.42% MOM</div>
      </div>

      <Card num="01" title="PORTFOLIO TRAJECTORY" meta="30D">
        <Sparkline points={data.spark} height={120} />
        <div className="page__grid-3" style={{ marginTop: 8 }}>
          <div className="fin-stat">
            <div className="fin-stat__label">Today</div>
            <div className="fin-stat__value">{fmtUSDDelta(data.daily)}</div>
            <div className="fin-stat__sub">+0.06%</div>
          </div>
          <div className="fin-stat">
            <div className="fin-stat__label">Week</div>
            <div className="fin-stat__value">+$28,940</div>
            <div className="fin-stat__sub">+1.39%</div>
          </div>
          <div className="fin-stat">
            <div className="fin-stat__label">Month</div>
            <div className="fin-stat__value">{fmtUSDDelta(data.monthly)}</div>
            <div className="fin-stat__sub">+8.42%</div>
          </div>
        </div>
      </Card>

      <Card num="02" title="ACCOUNTS" meta={<span>{data.accounts.length} CONNECTED</span>}>
        <div>
          {data.accounts.map((a) => (
            <div key={a.name} className="invest-row">
              <div className="invest-row__icon">{a.type.slice(0, 2)}</div>
              <div>
                <div className="invest-row__name">{a.name}</div>
                <div className="invest-row__sub">{a.type}</div>
              </div>
              <div className="invest-row__val">{fmtUSD(a.value)}</div>
              <div className={`invest-row__delta ${a.delta.startsWith("-") ? "invest-row__delta--down" : ""}`}>
                {a.delta}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="page__grid-2">
        <Card num="03" title="ALLOCATION" meta="BY CLASS">
          <AllocationBars accounts={data.accounts} />
        </Card>
        <Card num="04" title="THIS WEEK" meta="MOVEMENT">
          <div className="kpi-row" style={{ gap: 24 }}>
            <div className="kpi-row__item">
              <div className="kpi-row__num kpi-row__num--accent">+$28,940</div>
              <div className="kpi-row__lab">Realized + unrealized</div>
            </div>
            <div className="kpi-row__item">
              <div className="kpi-row__num">$12,420</div>
              <div className="kpi-row__lab">Spent</div>
            </div>
          </div>
          <div className="sparkbars" style={{ height: 50 }}>
            {[12,18,22,14,28,32,24,30,28,42,38,30,44,52].map((v, i) => (
              <div
                key={i}
                className={`sparkbars__bar ${i > 9 ? "sparkbars__bar--accent" : ""}`}
                style={{ height: `${(v / 55) * 100}%` }}
              />
            ))}
          </div>
          <div className="os-mono" style={{ marginTop: 4 }}>14 DAY CASH FLOW · NET</div>
        </Card>
      </div>
    </div>
  );
}

function AllocationBars({ accounts }) {
  // Group by type
  const groups = {};
  let total = 0;
  accounts.forEach((a) => {
    total += a.value;
    if (!groups[a.type]) groups[a.type] = 0;
    groups[a.type] += a.value;
  });
  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const colors = {
    EQUITY: "var(--os-accent)",
    CRYPTO: "var(--os-ember)",
    RETIRE: "var(--os-honey)",
    HYSA:   "var(--os-fg-3)",
    BANK:   "var(--os-fg-4)",
    "T-BILLS": "var(--os-fg-2)",
    PRIVATE: "var(--os-rust)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", border: "1px solid var(--os-line-1)" }}>
        {sorted.map(([type, v]) => (
          <div
            key={type}
            style={{ width: `${(v / total) * 100}%`, background: colors[type] || "var(--os-fg-4)" }}
            title={`${type} ${((v/total)*100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map(([type, v]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, background: colors[type] || "var(--os-fg-4)", borderRadius: 2 }} />
            <div style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--os-fg-3)" }}>
              {type}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--os-fg-1)" }}>
              {fmtUSD(v)}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--os-fg-4)", width: 50, textAlign: "right" }}>
              {((v / total) * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================
// HEALTH PAGE
// =========================================================
function HealthPage({ data }) {
  return (
    <div className="page">
      <div>
        <div className="page__title">
          Body · <em>recovered.</em>
        </div>
        <div className="page__sub">HEALTH · OURA + WHOOP + APPLE WATCH</div>
      </div>

      <Card num="01" title="THIS MORNING" meta="LAST NIGHT'S SLEEP">
        <div className="health-rings">
          <div className="ring-big" style={{ "--pct": data.recovery, "--c": "var(--os-accent)" }}>
            <div className="ring-big__inner">
              <div className="ring-big__val">{data.recovery}</div>
              <div className="ring-big__lab">Recovery</div>
            </div>
          </div>
          <div className="ring-big" style={{ "--pct": data.sleepScore, "--c": "var(--os-honey)" }}>
            <div className="ring-big__inner">
              <div className="ring-big__val">{data.sleepScore}</div>
              <div className="ring-big__lab">Sleep</div>
            </div>
          </div>
          <div className="ring-big" style={{ "--pct": (data.strain / 21) * 100, "--c": "var(--os-ember)" }}>
            <div className="ring-big__inner">
              <div className="ring-big__val">{data.strain}</div>
              <div className="ring-big__lab">Strain</div>
            </div>
          </div>
          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div className="kpi-big">{data.sleepHrs}</div>
            <div className="os-mono" style={{ marginTop: 6 }}>
              SLEEP · 12:18 → 07:56
            </div>
            <div className="os-mono" style={{ marginTop: 16, color: "var(--os-accent)" }}>
              ▲ READY TO TRAIN
            </div>
          </div>
        </div>
      </Card>

      <div className="page__grid-3">
        <Card num="02" title="HRV · 14D">
          <div className="kpi-big">{data.hrv}<span className="kpi-big__unit">ms</span></div>
          <div className="sparkbars" style={{ height: 50 }}>
            {[58,62,64,70,68,72,66,69,73,75,71,74,76,76].map((v, i) => (
              <div
                key={i}
                className={`sparkbars__bar ${i > 8 ? "sparkbars__bar--accent" : ""}`}
                style={{ height: `${(v / 80) * 100}%` }}
              />
            ))}
          </div>
          <div className="os-mono">+9% MOM · TRENDING UP</div>
        </Card>

        <Card num="03" title="WEIGHT">
          <div className="kpi-big">{data.weight}<span className="kpi-big__unit">lb</span></div>
          <Sparkline points={[182.2, 181.6, 181.4, 181.1, 180.6, 180.2, 179.8, 179.6, 179.2, 178.9, 178.6, 178.4]} height={50} />
          <div className="os-mono">−4.2 lb · 12 WK</div>
        </Card>

        <Card num="04" title="STEPS">
          <div className="kpi-big">{data.steps.toLocaleString()}</div>
          <div className="sparkbars" style={{ height: 50 }}>
            {[6.2,8.4,9.1,7.8,10.2,12.4,4.8,9.2,8.6,11.4,7.9,8.2].map((v, i) => (
              <div
                key={i}
                className={`sparkbars__bar ${i > 7 ? "sparkbars__bar--accent" : ""}`}
                style={{ height: `${(v / 13) * 100}%` }}
              />
            ))}
          </div>
          <div className="os-mono">DAILY AVG · 8,940</div>
        </Card>
      </div>

      <div className="page__grid-3">
        <Card num="05" title="RHR" meta="bpm">
          <div className="kpi-big">{data.rhr}</div>
          <div className="os-mono">−3 vs 30D · ELITE BAND</div>
        </Card>
        <Card num="06" title="VO2 MAX">
          <div className="kpi-big">{data.biomarkers.vo2}</div>
          <div className="os-mono">TOP 5% · 25–34</div>
        </Card>
        <Card num="07" title="GLUCOSE" meta="LIBRE 3">
          <div className="kpi-big">{data.biomarkers.glucose}<span className="kpi-big__unit">mg/dL</span></div>
          <div className="os-mono">FASTED · 24H AVG 96</div>
        </Card>
      </div>
    </div>
  );
}

// =========================================================
// TRAIN PAGE
// =========================================================
function TrainPage({ data }) {
  return (
    <div className="page">
      <div>
        <div className="page__title">{data.name}</div>
        <div className="page__sub">{data.week} · TODAY</div>
      </div>

      <Card num="01" title="SESSION LIFTS" meta={<span>{data.lifts.length} LIFTS · TARGET 14.6 STRAIN</span>}>
        <div>
          {data.lifts.map((l, i) => (
            <div key={i} className="train-row">
              <div className="train-row__set">SET {l.set}</div>
              <div className="train-row__name">{l.name}</div>
              <div className="train-row__num">{l.reps} × </div>
              <div className="train-row__num" style={{ color: "var(--os-fg-1)" }}>{l.weight}</div>
              <div className="train-row__pr">{l.pr ? "★ PR" : ""}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="page__grid-2">
        <Card num="02" title="VOLUME · 8 WEEKS">
          <div className="sparkbars" style={{ height: 90 }}>
            {[42,48,46,52,58,55,62,68].map((v, i) => (
              <div
                key={i}
                className={`sparkbars__bar ${i > 4 ? "sparkbars__bar--accent" : ""}`}
                style={{ height: `${(v / 75) * 100}%` }}
              />
            ))}
          </div>
          <div className="kpi-row">
            <div className="kpi-row__item">
              <div className="kpi-row__num kpi-row__num--accent">68,400 lb</div>
              <div className="kpi-row__lab">This week</div>
            </div>
            <div className="kpi-row__item">
              <div className="kpi-row__num">+12.4%</div>
              <div className="kpi-row__lab">vs block 1</div>
            </div>
          </div>
        </Card>
        <Card num="03" title="SPLIT" meta="PUSH · PULL · LEGS">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { day: "MON", split: "Push · A", done: true },
              { day: "TUE", split: "Pull · A", done: true },
              { day: "WED", split: "Legs · A", done: true },
              { day: "THU", split: "Push · B", done: false, now: true },
              { day: "FRI", split: "Pull · B", done: false },
              { day: "SAT", split: "Legs · B", done: false },
              { day: "SUN", split: "Rest · zone 2", done: false },
            ].map((d) => (
              <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="os-mono" style={{ width: 40, color: d.now ? "var(--os-accent)" : "" }}>
                  {d.day}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: d.now ? "var(--os-fg-1)" : "var(--os-fg-2)" }}>
                  {d.split}
                </span>
                {d.done && <span style={{ color: "var(--os-accent)", fontSize: 13 }}>✓</span>}
                {d.now && <span className="pill pill--accent">NOW</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// =========================================================
// SOCIAL PAGE
// =========================================================
function SocialPage({ data }) {
  const total = data.reduce((a, s) => a + parseInt(s.count.replace(/,/g, ""), 10), 0);
  return (
    <div className="page">
      <div>
        <div className="page__title">
          Audience · <em>{total.toLocaleString()}.</em>
        </div>
        <div className="page__sub">SOCIAL · ACROSS 5 PLATFORMS · +469 THIS WEEK</div>
      </div>

      <Card num="01" title="GROWTH · 30D">
        <div className="sparkbars" style={{ height: 100 }}>
          {[12,18,14,22,28,24,30,26,34,38,32,40,44,38,46,52,48,56,60,54,62,68,72,66,74,80,76,82,88,94].map((v, i) => (
            <div
              key={i}
              className={`sparkbars__bar ${i > 22 ? "sparkbars__bar--accent" : ""}`}
              style={{ height: `${(v / 100) * 100}%` }}
            />
          ))}
        </div>
        <div className="kpi-row" style={{ marginTop: 8 }}>
          <div className="kpi-row__item">
            <div className="kpi-row__num kpi-row__num--accent">+1,842</div>
            <div className="kpi-row__lab">Net new · 30D</div>
          </div>
          <div className="kpi-row__item">
            <div className="kpi-row__num">2.4%</div>
            <div className="kpi-row__lab">Engagement</div>
          </div>
          <div className="kpi-row__item">
            <div className="kpi-row__num">14</div>
            <div className="kpi-row__lab">Posts · 30D</div>
          </div>
        </div>
      </Card>

      <Card num="02" title="PLATFORMS">
        <div>
          {data.map((s) => (
            <div key={s.plat} className="invest-row">
              <div className="invest-row__icon">{s.plat.slice(0, 2)}</div>
              <div>
                <div className="invest-row__name">{s.plat}</div>
                <div className="invest-row__sub">FOLLOWERS</div>
              </div>
              <div className="invest-row__val">{s.count}</div>
              <div className="invest-row__delta">{s.delta} · {s.pct}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// =========================================================
// JOURNAL PAGE
// =========================================================
function JournalPage() {
  const entries = [
    { date: "MAY 22 · TODAY", time: "07:12", title: "On the agent infra teardown",
      body: "Three observations after Hugo's call: (1) the long-horizon planner is the bottleneck, not the LLM. (2) Founders are over-indexing on tool use. (3) Memory is where the moat lives — and almost no one's working on it correctly." },
    { date: "MAY 21", time: "21:48", title: "Closed Decagon",
      body: "Wired the SAFE. 75k at a $40M cap. Sarah was clear, fast, no theatrics. The kind of operator I want in every deal. Note: introduce her to two of my LPs." },
    { date: "MAY 20", time: "06:42", title: "Pre-dawn — what would I work on if I had 10 years?",
      body: "Probably a calm OS for ambitious people. Not a feed. Not a chatbot. Something quiet that absorbs the noise and tells you the next move." },
    { date: "MAY 18", time: "23:11", title: "Pickleball clarity",
      body: "Strange: best ideas come during the third game, not at the desk. Diffuse mode beats focus mode for problem-finding. Filed under: schedule more diffuse time." },
  ];
  return (
    <div className="page">
      <div>
        <div className="page__title">
          Journal · <em>4 entries.</em>
        </div>
        <div className="page__sub">BRAIN · LAST 7 DAYS</div>
      </div>
      {entries.map((e, i) => (
        <Card key={i} num={String(i + 1).padStart(2, "0")} title={e.title} meta={<span>{e.date} · {e.time}</span>}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, lineHeight: 1.5, color: "var(--os-fg-2)" }}>
            {e.body}
          </div>
        </Card>
      ))}
    </div>
  );
}

Object.assign(window, {
  FinancePage, HealthPage, TrainPage, SocialPage, JournalPage
});
