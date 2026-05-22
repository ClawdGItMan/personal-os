// MOBILE app for MAX OS — companion to web
// Phone-sized vertical scroll with bottom tab bar
// Reuses some shared helpers but redoes layout for mobile.

const { useState: useMo, useEffect: useMoE, useRef: useMoR } = React;

// =========================================================
// MOBILE styles injected
// =========================================================
const __mobStyles = `
.m-app {
  width: 100%;
  height: 100%;
  background: var(--os-bg);
  color: var(--os-fg-1);
  display: flex;
  flex-direction: column;
  font-family: var(--font-body);
  overflow: hidden;
  position: relative;
}
.m-screen {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 0 16px 100px;
}
.m-screen::-webkit-scrollbar { display: none; }

.m-topbar {
  padding: 14px 16px 12px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--os-line-1);
}
.m-topbar__brand {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em;
  color: var(--os-fg-2);
}
.m-topbar__brand::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: var(--os-accent);
  box-shadow: 0 0 6px var(--os-accent-glow);
}
.m-topbar__time {
  font-family: var(--font-mono); font-size: 12px; color: var(--os-fg-1);
  font-variant-numeric: tabular-nums;
}
.m-greet {
  padding: 28px 0 20px;
}
.m-greet__hi {
  font-family: var(--font-display); font-size: 32px;
  letter-spacing: -0.02em; color: var(--os-fg-1); line-height: 1.05;
}
.m-greet__hi em { font-style: italic; }
.m-greet__date {
  margin-top: 8px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em;
  color: var(--os-fg-4); text-transform: uppercase;
}

.m-capture {
  display: flex; align-items: center; gap: 8px;
  background: var(--os-bg-3);
  border: 1px solid var(--os-line-2);
  border-radius: 12px;
  padding: 4px 4px 4px 14px;
  margin-bottom: 20px;
}
.m-capture input {
  flex: 1; background: transparent; border: none; outline: none;
  padding: 12px 0; font-size: 14px; color: var(--os-fg-1);
}
.m-capture input::placeholder { color: var(--os-fg-4); }
.m-capture__send {
  width: 36px; height: 36px; border-radius: 9px;
  background: var(--os-accent); color: var(--os-bg);
  display: flex; align-items: center; justify-content: center;
}

.m-card {
  background: var(--os-bg-2);
  border: 1px solid var(--os-line-1);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
}
.m-card__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.m-card__title {
  font-family: var(--font-mono); font-size: 11px;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--os-fg-3);
  display: flex; align-items: center; gap: 6px;
}
.m-card__num { color: var(--os-fg-5); }
.m-card__meta {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--os-fg-4);
}
.m-fin__net {
  font-family: var(--font-mono); font-size: 28px;
  color: var(--os-fg-1); letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
.m-fin__row {
  display: flex; justify-content: space-between; align-items: end;
  margin-bottom: 8px;
}
.m-fin__chg {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--os-accent);
  padding: 4px 8px;
  border: 1px solid var(--os-accent-dim);
  border-radius: 4px;
  background: var(--os-accent-soft);
}
.m-fin__grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  margin-top: 12px;
}
.m-fin__stat {
  background: var(--os-bg-3); border-radius: 8px; padding: 10px;
  border: 1px solid var(--os-line-1);
}
.m-fin__lab {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--os-fg-4);
}
.m-fin__val {
  margin-top: 4px;
  font-family: var(--font-mono); font-size: 16px;
  color: var(--os-accent); font-variant-numeric: tabular-nums;
}
.m-habit {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.m-habit__cell {
  background: var(--os-bg-3); border: 1px solid var(--os-line-1);
  border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  position: relative;
}
.m-habit__cell--done {
  background: var(--os-accent-soft);
  border-color: var(--os-accent-dim);
}
.m-habit__row { display: flex; align-items: center; gap: 8px; }
.m-habit__check {
  width: 14px; height: 14px; border-radius: 3px;
  border: 1px solid var(--os-line-3);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.m-habit__cell--done .m-habit__check {
  background: var(--os-accent); border-color: var(--os-accent);
}
.m-habit__cell--done .m-habit__check::after {
  content: "✓"; color: var(--os-bg); font-size: 9px; font-weight: 700;
}
.m-habit__name { font-size: 13px; color: var(--os-fg-1); }
.m-habit__sub {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--os-fg-4);
}
.m-event {
  display: grid; grid-template-columns: 60px 1fr;
  gap: 10px; padding: 9px 0;
  border-top: 1px solid var(--os-line-1);
}
.m-event:first-child { border-top: none; }
.m-event__time {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--os-fg-3); font-variant-numeric: tabular-nums;
}
.m-event__time--now { color: var(--os-accent); }
.m-event__title { font-size: 13px; color: var(--os-fg-1); }
.m-event__sub {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--os-fg-4); margin-top: 2px;
}
.m-nav {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-around;
  padding: 12px 6px 24px;
  background: var(--os-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--os-line-1);
}
.m-nav__btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 4px 10px;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--os-fg-4);
  border-radius: 8px;
}
.m-nav__btn--active { color: var(--os-fg-1); }
.m-nav__icon {
  font-family: var(--font-mono); font-size: 14px;
}

/* AGENT mobile */
.m-agent { display: flex; flex-direction: column; height: 100%; padding: 0; }
.m-agent__head { padding: 14px 16px; border-bottom: 1px solid var(--os-line-1); }
.m-agent__title {
  font-family: var(--font-display); font-size: 22px;
  color: var(--os-fg-1); letter-spacing: -0.01em;
}
.m-agent__sub {
  margin-top: 4px;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.16em; color: var(--os-accent);
  text-transform: uppercase;
  display: flex; align-items: center; gap: 6px;
}
.m-agent__sub::before {
  content: ""; width: 5px; height: 5px; border-radius: 50%;
  background: var(--os-accent);
  box-shadow: 0 0 5px var(--os-accent-glow);
}
.m-agent__scroll {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.m-msg {
  max-width: 86%;
  display: flex; flex-direction: column; gap: 4px;
}
.m-msg--me { align-self: flex-end; }
.m-msg__bubble {
  padding: 10px 12px; border-radius: 14px;
  background: var(--os-bg-2);
  border: 1px solid var(--os-line-1);
  font-size: 13px; line-height: 1.4;
}
.m-msg--me .m-msg__bubble {
  background: var(--os-accent-soft);
  border-color: var(--os-accent-dim);
}
.m-msg__meta {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--os-fg-5);
}
.m-agent__compose {
  padding: 12px; border-top: 1px solid var(--os-line-1);
}

/* HEALTH/FINANCE detail mobile */
.m-rings {
  display: flex; gap: 14px; align-items: center;
  padding: 8px 0;
}
.m-ring {
  --pct: 78;
  --c: var(--os-accent);
  width: 76px; height: 76px;
  border-radius: 50%;
  background: conic-gradient(var(--c) calc(var(--pct)*1%), var(--os-line-1) 0);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.m-ring__inner {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: var(--os-bg-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.m-ring__val { font-family: var(--font-mono); font-size: 17px; color: var(--os-fg-1); }
.m-ring__lab {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  color: var(--os-fg-4); text-transform: uppercase;
}
.m-kpi-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
  margin-top: 12px;
}
.m-kpi-cell {
  background: var(--os-bg-3); border-radius: 8px; padding: 10px;
  border: 1px solid var(--os-line-1);
}
.m-kpi-cell__num {
  font-family: var(--font-mono); font-size: 15px;
  color: var(--os-fg-1); font-variant-numeric: tabular-nums;
}
.m-kpi-cell__lab {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  color: var(--os-fg-4); text-transform: uppercase;
  margin-top: 3px;
}
`;

(function injectMobStyles() {
  if (document.getElementById("__mob_styles")) return;
  const el = document.createElement("style");
  el.id = "__mob_styles";
  el.textContent = __mobStyles;
  document.head.appendChild(el);
})();

// =========================================================
// MOBILE HOME
// =========================================================
function MobHome({ onOpenAgent }) {
  const data = window.MOS_DATA;
  const now = useClock();
  const [val, setVal] = useMo("");
  const [habits, setHabits] = useMo(data.habits);
  const [tasks, setTasks] = useMo(data.tasks);
  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const submit = (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    setVal("");
    onOpenAgent();
  };
  return (
    <div className="m-screen">
      <div className="m-greet">
        <div className="m-greet__hi">{greet}, <em>{data.operator.name}.</em></div>
        <div className="m-greet__date">{dayStr.toUpperCase()}</div>
      </div>
      <form className="m-capture" onSubmit={submit}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Capture or ask the agent…"
        />
        <button type="submit" className="m-capture__send">↑</button>
      </form>

      {/* Finance */}
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title"><span className="m-card__num">03 //</span>FINANCE PULSE</div>
          <div className="m-card__meta">30D</div>
        </div>
        <div className="m-fin__row">
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--os-fg-4)" }}>Net worth</div>
            <div className="m-fin__net">{fmtUSD(data.finance.netWorth)}</div>
          </div>
          <div className="m-fin__chg">↑ {fmtPct(data.finance.change30d)}</div>
        </div>
        <Sparkline points={data.finance.spark} height={50} />
        <div className="m-fin__grid">
          <div className="m-fin__stat">
            <div className="m-fin__lab">Daily</div>
            <div className="m-fin__val">{fmtUSDDelta(data.finance.daily)}</div>
          </div>
          <div className="m-fin__stat">
            <div className="m-fin__lab">Monthly</div>
            <div className="m-fin__val">{fmtUSDDelta(data.finance.monthly)}</div>
          </div>
        </div>
      </div>

      {/* Habits */}
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title"><span className="m-card__num">05 //</span>HABITS</div>
          <div className="m-card__meta">{habits.filter(h => h.done).length}/{habits.length}</div>
        </div>
        <div className="m-habit">
          {habits.slice(0, 6).map((h) => (
            <button
              key={h.id}
              className={`m-habit__cell ${h.done ? "m-habit__cell--done" : ""}`}
              onClick={() => setHabits(arr => arr.map(x => x.id === h.id ? {...x, done: !x.done} : x))}
            >
              <div className="m-habit__row">
                <div className="m-habit__check" />
                <div className="m-habit__name">{h.name}</div>
              </div>
              <div className="m-habit__sub">{h.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title"><span className="m-card__num">06 //</span>TODAY</div>
          <div className="m-card__meta">{data.calendar.events.length} EVENTS</div>
        </div>
        {data.calendar.events.slice(0, 6).map((e, i) => (
          <div key={i} className="m-event">
            <div className={`m-event__time ${e.now ? "m-event__time--now" : ""}`}>
              {e.time.split(" –")[0]}
            </div>
            <div>
              <div className="m-event__title">{e.title}</div>
              <div className="m-event__sub">{e.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Health snapshot */}
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title"><span className="m-card__num">08 //</span>BODY</div>
          <div className="m-card__meta">THIS MORNING</div>
        </div>
        <div className="m-rings">
          <div className="m-ring" style={{ "--pct": data.health.recovery }}>
            <div className="m-ring__inner">
              <div className="m-ring__val">{data.health.recovery}</div>
              <div className="m-ring__lab">Recover</div>
            </div>
          </div>
          <div className="m-ring" style={{ "--pct": data.health.sleepScore, "--c": "var(--os-honey)" }}>
            <div className="m-ring__inner">
              <div className="m-ring__val">{data.health.sleepScore}</div>
              <div className="m-ring__lab">Sleep</div>
            </div>
          </div>
        </div>
        <div className="m-kpi-row">
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.hrv}</div>
            <div className="m-kpi-cell__lab">HRV</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.rhr}</div>
            <div className="m-kpi-cell__lab">RHR</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num" style={{ color: "var(--os-accent)" }}>{data.health.strain}</div>
            <div className="m-kpi-cell__lab">Strain</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// MOBILE AGENT
// =========================================================
function MobAgent() {
  const data = window.MOS_DATA;
  const [messages, setMessages] = useMo(data.agent.messages);
  const [draft, setDraft] = useMo("");
  const [typing, setTyping] = useMo(false);
  const scrollRef = useMoR(null);

  useMoE(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const send = (txt) => {
    if (!txt.trim()) return;
    const id = Date.now();
    const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setMessages(m => [...m, { id, role: "you", time, source: "MOBILE", text: txt.trim() }]);
    setDraft("");
    setTyping(true);
    setTimeout(() => {
      const reply = window.pickReply(txt);
      setMessages(m => [...m, {
        id: id + 1, role: "agent",
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        source: "MAX OS", text: reply.text, chips: reply.chips,
      }]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="m-agent">
      <div className="m-agent__head">
        <div className="m-agent__title">Agent</div>
        <div className="m-agent__sub">CONNECTED · TELEGRAM @MAXOS_BOT</div>
      </div>
      <div className="m-agent__scroll" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`m-msg ${m.role === "you" ? "m-msg--me" : ""}`}>
            <div className="m-msg__meta">
              {m.role === "you" ? "YOU" : "AGENT"} · {m.time} · {m.source}
            </div>
            <div className="m-msg__bubble">{m.text}</div>
            {m.chips && m.chips.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                {m.chips.map((c, i) => {
                  const cls = c.kind === "ember" ? "msg__chip msg__chip--ember"
                    : c.kind === "sage" ? "msg__chip msg__chip--sage"
                    : "msg__chip";
                  return <button key={i} className={cls}>{c.label}</button>;
                })}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="m-msg">
            <div className="m-msg__meta">AGENT · TYPING…</div>
            <div className="m-msg__bubble">
              <div className="typing"><span/><span/><span/></div>
            </div>
          </div>
        )}
      </div>
      <div className="m-agent__compose">
        <form className="m-capture" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message agent…" />
          <button type="submit" className="m-capture__send">↑</button>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// MOBILE FINANCE detail
// =========================================================
function MobFinance() {
  const data = window.MOS_DATA;
  return (
    <div className="m-screen">
      <div className="m-greet">
        <div className="m-greet__hi"><em>Net worth.</em></div>
        <div className="m-greet__date">FINANCE · +8.42% MOM</div>
      </div>
      <div className="m-card">
        <div className="m-fin__net">{fmtUSD(data.finance.netWorth)}</div>
        <Sparkline points={data.finance.spark} height={80} />
        <div className="m-fin__grid">
          <div className="m-fin__stat">
            <div className="m-fin__lab">Daily</div>
            <div className="m-fin__val">{fmtUSDDelta(data.finance.daily)}</div>
          </div>
          <div className="m-fin__stat">
            <div className="m-fin__lab">Monthly</div>
            <div className="m-fin__val">{fmtUSDDelta(data.finance.monthly)}</div>
          </div>
        </div>
      </div>
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title">ACCOUNTS</div>
          <div className="m-card__meta">{data.finance.accounts.length}</div>
        </div>
        {data.finance.accounts.map((a) => (
          <div key={a.name} className="m-event">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--os-fg-4)", textTransform: "uppercase" }}>
              {a.type}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13 }}>{a.name}</div>
                <div className="m-event__sub" style={{ color: "var(--os-accent)" }}>{a.delta}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--os-fg-1)" }}>
                {fmtUSD(a.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================
// MOBILE HEALTH detail
// =========================================================
function MobHealth() {
  const data = window.MOS_DATA;
  return (
    <div className="m-screen">
      <div className="m-greet">
        <div className="m-greet__hi">Body · <em>recovered.</em></div>
        <div className="m-greet__date">OURA + WHOOP · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()}</div>
      </div>
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title">THIS MORNING</div>
          <div className="m-card__meta">SLEEP 12:18→07:56</div>
        </div>
        <div className="m-rings">
          <div className="m-ring" style={{ "--pct": data.health.recovery }}>
            <div className="m-ring__inner">
              <div className="m-ring__val">{data.health.recovery}</div>
              <div className="m-ring__lab">Recover</div>
            </div>
          </div>
          <div className="m-ring" style={{ "--pct": data.health.sleepScore, "--c": "var(--os-honey)" }}>
            <div className="m-ring__inner">
              <div className="m-ring__val">{data.health.sleepScore}</div>
              <div className="m-ring__lab">Sleep</div>
            </div>
          </div>
          <div className="m-ring" style={{ "--pct": (data.health.strain / 21) * 100, "--c": "var(--os-ember)" }}>
            <div className="m-ring__inner">
              <div className="m-ring__val">{data.health.strain}</div>
              <div className="m-ring__lab">Strain</div>
            </div>
          </div>
        </div>
      </div>
      <div className="m-card">
        <div className="m-card__head">
          <div className="m-card__title">METRICS</div>
        </div>
        <div className="m-kpi-row">
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.hrv}<span style={{ fontSize: 9, color: "var(--os-fg-4)", marginLeft: 2 }}>ms</span></div>
            <div className="m-kpi-cell__lab">HRV</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.rhr}</div>
            <div className="m-kpi-cell__lab">RHR</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.weight}</div>
            <div className="m-kpi-cell__lab">Weight</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.steps.toLocaleString()}</div>
            <div className="m-kpi-cell__lab">Steps</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.biomarkers.vo2}</div>
            <div className="m-kpi-cell__lab">VO2</div>
          </div>
          <div className="m-kpi-cell">
            <div className="m-kpi-cell__num">{data.health.biomarkers.glucose}</div>
            <div className="m-kpi-cell__lab">Glucose</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// MOBILE APP shell
// =========================================================
function MobApp() {
  // Read default tab from query/hash so the canvas can show different mobile states.
  const initialTab = (() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("start") || url.hash.replace("#", "");
      if (["HOME", "FINANCE", "HEALTH", "AGENT"].includes(q)) return q;
    } catch (e) {}
    return "HOME";
  })();
  const [tab, setTab] = useMo(initialTab);
  const now = useClock();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className="m-app">
      <div className="m-topbar">
        <div className="m-topbar__brand">MAX OS · V0</div>
        <div className="m-topbar__time">{hh}:{mm}</div>
      </div>
      {tab === "HOME"    && <MobHome onOpenAgent={() => setTab("AGENT")} />}
      {tab === "FINANCE" && <MobFinance />}
      {tab === "HEALTH"  && <MobHealth />}
      {tab === "AGENT"   && <MobAgent />}
      <div className="m-nav">
        {[
          { id: "HOME",    icon: "◉", label: "Home" },
          { id: "FINANCE", icon: "$", label: "Money" },
          { id: "HEALTH",  icon: "♡", label: "Body" },
          { id: "AGENT",   icon: "✦", label: "Agent" },
        ].map((n) => (
          <button
            key={n.id}
            className={`m-nav__btn ${tab === n.id ? "m-nav__btn--active" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <span className="m-nav__icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MobApp />);
