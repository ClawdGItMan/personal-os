// Agent panel — Telegram-fed chat with simulated agent replies

const { useState: useAS, useEffect: useAE, useRef: useAR } = React;

// Canned replies — picks heuristically based on user input
const CANNED_REPLIES = [
  {
    match: /(weight|weigh|lbs?|kg|pound)/i,
    text: (input) => `Logged. Looks like you're trending toward your 175 lb goal. I'll roll the 7-day average tonight.`,
    chips: [{ label: "View weight trend", kind: "sage" }],
  },
  {
    match: /(meal|ate|eat|breakfast|lunch|dinner|snack|kcal|calorie)/i,
    text: () => `Got it. Estimated ~520 kcal, 38g protein. Added to today (under macro budget).`,
    chips: [
      { label: "Nutrition", kind: "ember" },
      { label: "Edit", kind: "" },
    ],
  },
  {
    match: /(bench|squat|deadlift|lift|set|reps?|press|workout)/i,
    text: () => `Saved that lift. New 3RM PR on bench at 265 lb — up 10 lb from block 1. Want me to bump the Wednesday volume?`,
    chips: [
      { label: "Bump volume", kind: "sage" },
      { label: "Keep program", kind: "" },
    ],
  },
  {
    match: /(idea|concept|thesis|memo|note|thought)/i,
    text: () => `Captured to Brain. Tagged: thesis, agent-infra. I'll surface this on Friday when you sit down to write v3.`,
    chips: [
      { label: "Open in Brain", kind: "" },
      { label: "Tag…", kind: "" },
    ],
  },
  {
    match: /(meeting|call|coffee|with|book)/i,
    text: () => `Added to calendar. I left a 15-min buffer before, since your last 4 meetings overran.`,
    chips: [{ label: "Calendar", kind: "ember" }],
  },
  {
    match: /(invest|stock|portfolio|wired|safe|spend|paid|bought)/i,
    text: () => `Logged. I'll reconcile with Plaid in the next sync — should hit Finance Pulse by 18:00.`,
    chips: [
      { label: "Finance", kind: "ember" },
      { label: "Receipt", kind: "" },
    ],
  },
  {
    match: /(remind|tomorrow|tonight|later|todo|task)/i,
    text: () => `On it. Added to Today, priority not set — say "make it a priority" and I'll star it.`,
    chips: [
      { label: "Star it", kind: "sage" },
      { label: "Move to tomorrow", kind: "" },
    ],
  },
  {
    match: /(summar|how am i|status|recap)/i,
    text: () => `Quick read: net worth +8.4% MoM, 47-day streak intact, 3 key items closed today, 2 left. Sleep at 88, recovery 82 — green light to push.`,
    chips: [
      { label: "Full brief", kind: "" },
      { label: "Skip", kind: "" },
    ],
  },
];

function pickReply(input) {
  for (const r of CANNED_REPLIES) {
    if (r.match.test(input)) return { text: r.text(input), chips: r.chips };
  }
  return {
    text: `Got it. Saved to inbox — I'll route this once I have more context. Want to tag it now?`,
    chips: [
      { label: "Tag…", kind: "" },
      { label: "Skip", kind: "" },
    ],
  };
}

function Chip({ chip }) {
  const cls = chip.kind === "ember" ? "msg__chip msg__chip--ember"
    : chip.kind === "sage"  ? "msg__chip msg__chip--sage"
    : chip.kind === "honey" ? "msg__chip msg__chip--honey"
    : "msg__chip";
  return <button className={cls}>{chip.label}</button>;
}

function Message({ m }) {
  const isMe = m.role === "you";
  return (
    <div className={`msg ${isMe ? "msg--me" : "msg--agent"}`}>
      <div className="msg__meta">
        <span className="msg__role">{isMe ? "YOU" : "AGENT"}</span>
        <span>·</span>
        <span>{m.time}</span>
        <span>·</span>
        <span>{m.source}</span>
      </div>
      <div className="msg__bubble">{m.text}</div>
      {m.chips && m.chips.length > 0 && (
        <div className="msg__action">
          {m.chips.map((c, i) => <Chip key={i} chip={c} />)}
        </div>
      )}
    </div>
  );
}

function AgentPanel({ initialMessages, externalMessages, suggestions, onCommand }) {
  const [messages, setMessages] = useAS(initialMessages);
  const [draft, setDraft] = useAS("");
  const [typing, setTyping] = useAS(false);
  const scrollRef = useAR(null);

  // When parent pushes new external messages, append
  useAE(() => {
    if (!externalMessages || externalMessages.length === 0) return;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const fresh = externalMessages.filter((m) => !existingIds.has(m.id));
      return [...prev, ...fresh];
    });
  }, [externalMessages]);

  // Auto-scroll on new messages
  useAE(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const send = (txt) => {
    if (!txt.trim()) return;
    const id = Date.now();
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    setMessages((m) => [...m, { id, role: "you", time, source: "MAX OS", text: txt.trim() }]);
    setDraft("");
    setTyping(true);
    setTimeout(() => {
      const reply = pickReply(txt);
      setMessages((m) => [...m, {
        id: id + 1,
        role: "agent",
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", hour12: false
        }),
        source: "MAX OS",
        text: reply.text,
        chips: reply.chips,
      }]);
      setTyping(false);
      if (onCommand) onCommand(txt);
    }, 900 + Math.random() * 700);
  };

  return (
    <div className="agent">
      <div className="agent__head">
        <div className="agent__title-row">
          <div className="agent__title">
            <span className="agent__title-num">11 //</span>
            <span className="agent__title-name">AGENT</span>
          </div>
          <div className="agent__status">CONNECTED</div>
        </div>
        <div className="agent__sub">
          <span>↗ <a>TELEGRAM @maxOS_bot</a></span>
          <span>·</span>
          <span>Always listening</span>
        </div>
      </div>

      <div className="agent__scroll" ref={scrollRef}>
        <div className="agent__divider">Earlier today</div>
        {messages.map((m) => <Message key={m.id} m={m} />)}
        {typing && (
          <div className="msg msg--agent">
            <div className="msg__meta">
              <span className="msg__role">AGENT</span>
              <span>·</span>
              <span>typing…</span>
            </div>
            <div className="msg__bubble">
              <div className="typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
      </div>

      <div className="agent__compose">
        <form
          className="agent__compose-box"
          onSubmit={(e) => { e.preventDefault(); send(draft); }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message — synced to Telegram"
          />
          <button type="submit" className="agent__send" aria-label="Send">↑</button>
        </form>
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {suggestions.map((s) => (
            <button
              key={s}
              className="pill"
              onClick={() => send(s)}
              style={{ cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="agent__compose-meta">
          <span>↩ to send · ⌥↩ for newline</span>
          <span className="agent__compose-meta__tg">● TG SYNCED</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentPanel, pickReply });
