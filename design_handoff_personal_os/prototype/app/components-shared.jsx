// Shared chrome: TopBar, Card, small helpers
// Exports to window so other JSX files can use them.

const { useState, useEffect, useRef, useMemo } = React;

// =========================================================
// Live clock hook
// =========================================================
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// =========================================================
// Card — the base module container
// =========================================================
function Card({ num, title, meta, children, style, className = "", noPad = false }) {
  return (
    <div className={`os-card ${className}`} style={style}>
      {(num || title || meta) && (
        <div className="os-card__head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {num && <span className="os-card__num">{num} //</span>}
            {title && <span className="os-card__title">{title}</span>}
          </div>
          {meta && <div className="os-card__meta">{meta}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// =========================================================
// Top bar — tabs + brand + clock + me
// =========================================================
function TopBar({ active, onChange, demoOn, onToggleDemo }) {
  const now = useClock();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric"
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  const tabs = ["HOME", "FINANCE", "HEALTH", "TRAIN", "SOCIAL", "JOURNAL"];

  return (
    <div className="os-topbar">
      <div className="os-topbar__brand">
        <span className="os-topbar__dot" />
        <span>MAX OS</span>
        <span className="os-topbar__ver">// V0</span>
      </div>
      <div className="os-topbar__nav">
        {tabs.map((t) => (
          <button
            key={t}
            className={`os-tab ${active === t ? "os-tab--active" : ""}`}
            onClick={() => onChange(t)}
          >
            <span className="os-tab__box">{t}</span>
          </button>
        ))}
      </div>
      <div className="os-topbar__right">
        <button className="os-topbar__chip" title="Export current view">
          ↓ EXPORT
        </button>
        <button
          className={`os-topbar__chip ${demoOn ? "os-topbar__chip--demo" : ""}`}
          onClick={onToggleDemo}
          title="Toggle demo data"
        >
          {demoOn ? "DEMO ON" : "DEMO OFF"}
        </button>
        <span style={{ padding: "0 6px" }}>{dateStr}</span>
        <span className="os-topbar__time">{timeStr}</span>
        <div className="os-topbar__me">MA</div>
      </div>
    </div>
  );
}

// =========================================================
// Sparkline — SVG, area + line
// =========================================================
function Sparkline({ points, height = 64, color = "var(--os-accent)" }) {
  const w = 240;
  const h = height;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const pts = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p - min) / range) * (h - 8) - 4;
    return [x, y];
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  return (
    <svg className="fin-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: `${h}px` }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={color}
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="6"
        fill={color}
        opacity="0.2"
      />
    </svg>
  );
}

// =========================================================
// Modal
// =========================================================
function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="os-modal-scrim" onClick={onClose}>
      <div className="os-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal__head">
          <div className="os-modal__title">{title}</div>
          <button className="os-modal__close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// =========================================================
// Format helpers
// =========================================================
const fmtUSD = (n) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtUSDDelta = (n) =>
  (n >= 0 ? "+$" : "-$") + Math.abs(n).toLocaleString("en-US");
const fmtPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

Object.assign(window, {
  useClock, Card, TopBar, Sparkline, Modal,
  fmtUSD, fmtUSDDelta, fmtPct,
});
