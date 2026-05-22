// MAX OS — main entry. Composes all modules + agent panel.

const { useState: useM, useEffect: useME, useMemo: useMM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "typography": "balanced",
  "density": "comfortable",
  "agent_open": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [page, setPage] = useM("HOME");
  const [demoOn, setDemoOn] = useM(true);
  const [tasks, setTasks] = useM(window.MOS_DATA.tasks);
  const [habits, setHabits] = useM(window.MOS_DATA.habits);
  const [external, setExternal] = useM([]); // messages pushed in from Session capture
  const [openModal, setOpenModal] = useM(null);

  // Apply theme to root element
  useME(() => {
    document.documentElement.setAttribute("data-theme", t.theme || "dark");
  }, [t.theme]);

  // Apply density
  useME(() => {
    document.documentElement.style.setProperty(
      "--os-density",
      t.density === "tight" ? "10px" : "14px"
    );
  }, [t.density]);

  // Apply typography
  useME(() => {
    const root = document.documentElement;
    if (t.typography === "mono-heavy") {
      root.style.setProperty("--font-display", '"JetBrains Mono", monospace');
    } else if (t.typography === "serif-heavy") {
      root.style.setProperty("--font-display", '"Newsreader", Georgia, serif');
    } else {
      root.style.removeProperty("--font-display");
    }
  }, [t.typography]);

  const toggleTask = (id) => {
    setTasks((arr) => arr.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  };
  const toggleHabit = (id) => {
    setHabits((arr) => arr.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  };

  const onCapture = (text) => {
    // Push into agent panel as a new "you" message from the capture bar
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    const id = Date.now();
    setExternal((arr) => [...arr, {
      id, role: "you", time, source: "WEB CAPTURE", text
    }]);
  };

  const data = window.MOS_DATA;

  return (
    <div className="os-app">
      <TopBar
        active={page}
        onChange={setPage}
        demoOn={demoOn}
        onToggleDemo={() => setDemoOn(!demoOn)}
      />
      <div className="os-main">
        <div className="os-col os-col--left">
          {page === "HOME" && (
            <>
              <OperatorCard data={data.operator} />
              <FinancePulse data={data.finance} onOpen={() => setPage("FINANCE")} />
              <TasksCard tasks={tasks} onToggle={toggleTask} />
            </>
          )}
          {page !== "HOME" && (
            <>
              <OperatorCard data={data.operator} />
              <Card num="·" title="QUICK SWITCH" meta="">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {["HOME", "FINANCE", "HEALTH", "TRAIN", "SOCIAL", "JOURNAL"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        textAlign: "left",
                        padding: "9px 10px",
                        borderRadius: 6,
                        background: p === page ? "var(--os-bg-3)" : "transparent",
                        color: p === page ? "var(--os-fg-1)" : "var(--os-fg-3)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        border: p === page ? "1px solid var(--os-line-2)" : "1px solid transparent",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Card>
              <TasksCard tasks={tasks} onToggle={toggleTask} />
            </>
          )}
        </div>

        <div className="os-col os-col--center">
          {page === "HOME" && (
            <>
              <SessionCard operator={data.operator} onCapture={onCapture} />
              <HabitsCard habits={habits} onToggle={toggleHabit} />
              <CalendarCard cal={data.calendar} />
              <div className="row3">
                <NutritionCard n={data.nutrition} />
                <HealthCard h={data.health} />
                <SocialCard social={data.social} />
              </div>
              <TrainCard w={data.workout} />
            </>
          )}
          {page === "FINANCE" && <FinancePage data={data.finance} />}
          {page === "HEALTH"  && <HealthPage data={data.health} />}
          {page === "TRAIN"   && <TrainPage data={data.workout} />}
          {page === "SOCIAL"  && <SocialPage data={data.social} />}
          {page === "JOURNAL" && <JournalPage />}
        </div>

        <div className="os-col os-col--right" style={{ padding: 0, gap: 0 }}>
          <AgentPanel
            initialMessages={data.agent.messages}
            externalMessages={external}
            suggestions={data.agent.suggestions}
          />
        </div>
      </div>

      {/* TWEAKS PANEL */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio
          label="Mode"
          value={t.theme}
          onChange={(v) => setTweak("theme", v)}
          options={[
            { value: "dark",   label: "Dark" },
            { value: "light",  label: "Cream" },
            { value: "hybrid", label: "Warm" },
          ]}
        />
        <TweakSection label="Typography" />
        <TweakRadio
          label="Heads"
          value={t.typography}
          onChange={(v) => setTweak("typography", v)}
          options={[
            { value: "serif-heavy", label: "Serif" },
            { value: "balanced",    label: "Mix" },
            { value: "mono-heavy",  label: "Mono" },
          ]}
        />
        <TweakSection label="Density" />
        <TweakRadio
          label="Layout"
          value={t.density}
          onChange={(v) => setTweak("density", v)}
          options={[
            { value: "tight",       label: "Operator" },
            { value: "comfortable", label: "Calm" },
          ]}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
