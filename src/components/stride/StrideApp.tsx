"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Barbell,
  Bell,
  BowlFood,
  CalendarBlank,
  CaretDown,
  ChartBar,
  GearSix,
  House,
  LinkSimple,
  List,
  Signpost,
  Sparkle,
} from "@phosphor-icons/react";
import type { Run, Session, View } from "@/lib/stride/types";
import { StrideProvider, useStride } from "./Store";
import { Mark } from "./ui";
import { Dashboard, TrainingPlan } from "./Dashboard";
import Activities from "./Activities";
import Coach from "./Coach";
import { Nutrition, Recovery } from "./Wellness";
import Connections from "./Connections";
import Settings from "./Settings";
import { CheckinForm, LogRun, RunDetail, SessionDetail } from "./Forms";

const navigation = [
  { title: "Overview", icon: House },
  { title: "Training plan", icon: CalendarBlank },
  { title: "Activities", icon: ChartBar },
  { title: "AI coach", icon: Sparkle },
  { title: "Nutrition", icon: BowlFood },
  { title: "Strength & recovery", icon: Barbell },
] as const;
export default function StrideApp() {
  return (
    <div className="stride">
      <StrideProvider>
        <App />
      </StrideProvider>
    </div>
  );
}
function App() {
  const { state, view, navigate, notice } = useStride();
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<
    "log" | "checkin" | "session" | "run" | null
  >(null);
  const [selectedSession, setSelectedSession] = useState<Session>();
  const [selectedRun, setSelectedRun] = useState<Run>();
  const [editingRun, setEditingRun] = useState<Run>();
  const pending = state.adjustments.filter(
    (a) => a.status === "pending",
  ).length;
  const go = (next: View) => {
    navigate(next);
    setMobileNav(false);
  };
  const logRun = () => {
    setEditingRun(undefined);
    setSelectedSession(undefined);
    setModal("log");
  };
  const checkin = () => setModal("checkin");
  const openSession = (session: Session) => {
    setSelectedSession(session);
    setModal("session");
  };
  const openRun = (run: Run) => {
    setSelectedRun(run);
    setModal("run");
  };
  return (
    <>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`stride-sidebar ${mobileNav ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => go("Overview")}
          aria-label="Stride home"
        >
          <Mark />
          <span>
            stride<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-symbol">
            <Signpost size={21} />
          </span>
          <span>
            <strong>My running journey</strong>
            <small>Marathon training</small>
          </span>
          <CaretDown size={13} />
        </div>
        <span className="nav-label">YOUR TRAINING</span>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.title}
              className={`nav-item ${view === item.title ? "active" : ""}`}
              onClick={() => go(item.title)}
              aria-current={view === item.title ? "page" : undefined}
            >
              <item.icon
                size={20}
                weight={view === item.title ? "fill" : "regular"}
              />
              <span>{item.title}</span>
              {item.title === "AI coach" && (
                <span className="nav-ai-label">AI</span>
              )}
              {item.title === "Training plan" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span className="sidebar-quote-mark">“</span>
            <p>
              You don’t have to go fast.
              <br />
              You just have to keep going.
            </p>
            <span>ONE RUN AT A TIME</span>
            <svg viewBox="0 0 170 40" aria-hidden="true">
              <path
                d="M-10 34C25 30 22 6 63 14s45 30 71 6 55-12 65-9"
                fill="none"
                stroke="#a8b18d"
                strokeWidth="1.5"
              />
              <path
                d="M-10 42C25 38 22 14 63 22s45 30 71 6 55-12 65-9"
                fill="none"
                stroke="#c9cfba"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <button
            className={`nav-item ${view === "Connections" ? "active" : ""}`}
            onClick={() => go("Connections")}
          >
            <LinkSimple size={20} />
            <span>Connections</span>
          </button>
          <button
            className={`nav-item ${view === "Settings" ? "active" : ""}`}
            onClick={() => go("Settings")}
          >
            <GearSix size={20} />
            <span>Settings</span>
          </button>
          <button className="sidebar-profile" onClick={() => go("Settings")}>
            <span className="profile-avatar">
              {state.profile.name.slice(0, 1)}
            </span>
            <span>
              <strong>
                {state.profile.name === "Runner"
                  ? "Your runner profile"
                  : state.profile.name}
              </strong>
              <small>Everyday athlete</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </aside>
      <div className="stride-workspace">
        <header className="stride-topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <List size={23} />
            </button>
            <span className="breadcrumb">My training</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            {state.demo ? (
              <button className="demo-badge" onClick={() => go("Settings")}>
                <span />
                Demo workspace
                <ArrowUpRight size={12} />
              </button>
            ) : (
              <span className="saved-badge">
                <span className="status-dot" />
                Saved on this device
              </span>
            )}
            <span className="topbar-divider" />
            <button
              className="icon-button notification-button"
              aria-label={
                pending
                  ? `${pending} training plan suggestions`
                  : "View training plan suggestions"
              }
              onClick={() => go("Training plan")}
            >
              <Bell size={20} />
              {pending > 0 && <span />}
            </button>
            <button
              className="topbar-avatar"
              aria-label="Open profile settings"
              onClick={() => go("Settings")}
            >
              {state.profile.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main className="stride-main" id="main-content" key={view}>
          {view === "Overview" && (
            <Dashboard
              openSession={openSession}
              openRun={openRun}
              checkin={checkin}
              logRun={logRun}
            />
          )}
          {view === "Training plan" && (
            <TrainingPlan openSession={openSession} />
          )}
          {view === "Activities" && (
            <Activities openRun={openRun} logRun={logRun} />
          )}
          {view === "AI coach" && <Coach checkin={checkin} />}
          {view === "Nutrition" && <Nutrition />}
          {view === "Strength & recovery" && <Recovery checkin={checkin} />}
          {view === "Connections" && <Connections />}
          {view === "Settings" && <Settings />}
          <footer className="stride-footer">
            <span>
              <Mark small />
              Built around your kind of progress.
            </span>
            <span>ONE RUN AT A TIME.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="stride-toast" role="status">
          <span>{notice}</span>
        </div>
      )}
      {modal === "log" && (
        <LogRun
          close={() => setModal(null)}
          existing={editingRun}
          session={selectedSession}
        />
      )}
      {modal === "checkin" && <CheckinForm close={() => setModal(null)} />}
      {modal === "session" && selectedSession && (
        <SessionDetail
          session={selectedSession}
          close={() => setModal(null)}
          log={(session) => {
            setSelectedSession(session);
            setEditingRun(undefined);
            setModal("log");
          }}
        />
      )}
      {modal === "run" && selectedRun && (
        <RunDetail
          run={selectedRun}
          close={() => setModal(null)}
          edit={(run) => {
            setEditingRun(run);
            setModal("log");
          }}
        />
      )}
    </>
  );
}
