"use client";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  DownloadSimple,
  FileArrowUp,
  Flag,
  ShieldCheck,
} from "@phosphor-icons/react";
import { initialState } from "@/lib/stride/demo";
import { addDays, dayKey } from "@/lib/stride/training";
import { useStride } from "./Store";
import { downloadFile } from "./Activities";
import { Modal, SectionTitle, Tag } from "./ui";
import { workspaceSchema } from "@/lib/stride/schema";
import type { StrideState } from "@/lib/stride/types";

export default function Settings() {
  const { state, setState, toast, navigate } = useStride();
  const [resetOpen, setResetOpen] = useState(false);
  const restoreFile = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<StrideState | null>(null);
  async function readBackup(file: File) {
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Please choose a Stride backup smaller than 20 MB.");
      const parsed = workspaceSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        throw new Error(
          "This file isn’t a valid Stride backup. Your current data hasn’t changed.",
        );
      setRestore(parsed.data);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "That backup could not be read.",
      );
    } finally {
      if (restoreFile.current) restoreFile.current.value = "";
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h1>Your starting point. Your finish line.</h1>
          <p>A few meaningful details to shape your training.</p>
        </div>
        {state.demo && <Tag tone="amber">Sample profile</Tag>}
      </div>
      <div className="settings-layout">
        <section className="panel profile-panel">
          <SectionTitle
            title="Your runner profile"
            detail="Start from what feels comfortable today."
          />
          <form
            className="stride-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const goalTime = String(data.get("goalTime"));
              if (!/^([2-9]):[0-5]\d$/.test(goalTime)) {
                toast(
                  "Enter a goal time between 2:00 and 9:59, using hours:minutes.",
                );
                return;
              }
              const profile = {
                name: String(data.get("name")).trim() || "Runner",
                raceName: String(data.get("raceName")).trim(),
                raceDate: String(data.get("raceDate")),
                goalTime,
                weeklyKm: Number(data.get("weeklyKm")),
                days: Number(data.get("days")),
              };
              setState((previous) =>
                previous
                  ? {
                      ...previous,
                      profile,
                      overrides: {},
                      adjustments: previous.adjustments.filter(
                        (a) => a.status !== "pending",
                      ),
                    }
                  : previous,
              );
              toast(
                "Profile saved. Your upcoming starter schedule has been rebuilt.",
              );
            }}
          >
            <label>
              What should we call you?
              <input
                name="name"
                required
                defaultValue={state.profile.name}
                maxLength={50}
              />
            </label>
            <div className="form-divider" />
            <span className="form-section-label">
              <Flag size={17} />
              Your race goal
            </span>
            <label>
              Race name
              <input
                name="raceName"
                required
                defaultValue={state.profile.raceName}
                maxLength={100}
              />
            </label>
            <div className="form-grid">
              <label>
                Race date
                <input
                  name="raceDate"
                  type="date"
                  required
                  defaultValue={state.profile.raceDate}
                  min={dayKey(addDays(new Date(), 1))}
                  max={dayKey(addDays(new Date(), 730))}
                />
              </label>
              <label>
                Goal finish time · h:mm
                <input
                  name="goalTime"
                  required
                  defaultValue={state.profile.goalTime}
                  placeholder="3:45"
                  pattern="[2-9]:[0-5][0-9]"
                />
              </label>
            </div>
            <div className="form-divider" />
            <span className="form-section-label">
              Your current running routine
            </span>
            <div className="form-grid">
              <label>
                Recent comfortable weekly distance · km
                <input
                  name="weeklyKm"
                  type="number"
                  min="5"
                  max="150"
                  step="1"
                  required
                  defaultValue={state.profile.weeklyKm}
                />
              </label>
              <label>
                Runs per week
                <select name="days" defaultValue={state.profile.days}>
                  <option value={3}>3 runs</option>
                  <option value={4}>4 runs</option>
                  <option value={5}>5 runs</option>
                </select>
              </label>
            </div>
            <div className="info-note">
              Your plan uses this recent distance as its baseline, includes
              recovery weeks, and reduces volume before race day. Saving profile
              changes rebuilds future sessions and clears pending adjustments.
            </div>
            <button type="submit" className="button primary">
              Save my profile
              <Check size={17} />
            </button>
          </form>
        </section>
        <aside>
          <section className="settings-intro">
            <span className="small-kicker">YOUR OWN KIND OF PROGRESS</span>
            <h2>A finish line is personal.</h2>
            <p>
              A time goal can give you direction. Getting to the start healthy,
              confident, and ready matters, too.
            </p>
            <button
              className="text-button"
              onClick={() => navigate("AI coach")}
            >
              Talk through your goal
              <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel data-panel">
            <SectionTitle title="Your workspace & data" />
            <p>
              This version saves your profile and training history in this
              browser. Export a backup before clearing browser storage or
              changing devices.
            </p>
            <button
              className="button secondary full"
              onClick={() =>
                downloadFile(
                  `stride-backup-${dayKey()}.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <DownloadSimple size={17} />
              Export full backup
            </button>
            <button
              className="button secondary full"
              onClick={() => restoreFile.current?.click()}
            >
              <FileArrowUp size={17} />
              Restore a backup
            </button>
            <input
              hidden
              ref={restoreFile}
              aria-label="Stride backup file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readBackup(file);
              }}
            />
            <button
              className="button secondary full"
              onClick={() => navigate("Connections")}
            >
              <ShieldCheck size={17} />
              Manage connections
            </button>
            <div className="form-divider" />
            <h3>
              {state.demo
                ? "Ready for your own miles?"
                : "A fresh starting point"}
            </h3>
            <p>
              {state.demo
                ? "Clear the example activities and keep your profile to start tracking your own journey."
                : "Clear this browser’s training history, check-ins, meals, and coach conversation. Your profile stays."}
            </p>
            <button
              className="button secondary full"
              onClick={() => setResetOpen(true)}
            >
              {state.demo ? "Start my own training log" : "Clear training data"}
              <ArrowRight size={17} />
            </button>
          </section>
          <p className="source-note">
            You can disconnect providers and disable live AI separately.
            Exported backups contain your personal training data.
          </p>
        </aside>
      </div>
      {restore && (
        <Modal
          title="Restore this training workspace?"
          subtitle={`This backup contains ${restore.runs.length} runs and a profile for ${restore.profile.name}. Restoring replaces the current browser workspace.`}
          close={() => setRestore(null)}
        >
          <div className="stride-form">
            <button
              className="button secondary full"
              onClick={() =>
                downloadFile(
                  `stride-before-restore-${dayKey()}.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <DownloadSimple size={17} />
              Back up my current workspace
            </button>
            <button
              className="button primary full"
              onClick={() => {
                setState({ ...restore, cloudCoach: false });
                setRestore(null);
                toast(
                  "Backup restored. Live AI stays off until you enable sharing again.",
                );
                navigate("Overview");
              }}
            >
              Restore backup
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {resetOpen && (
        <Modal
          title={
            state.demo
              ? "Make this journey yours."
              : "Clear your training history?"
          }
          subtitle="Your runner profile stays. Activities, meals, check-ins, and chat history will be cleared from this browser."
          close={() => setResetOpen(false)}
        >
          <div className="stride-form">
            <button
              className="button secondary full"
              onClick={() =>
                downloadFile(
                  `stride-backup-${dayKey()}.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <DownloadSimple size={17} />
              Export a backup first
            </button>
            <button
              className="button primary full"
              onClick={() => {
                setState({ ...initialState(false), profile: state.profile });
                setResetOpen(false);
                toast("Your fresh training log is ready.");
                navigate("Overview");
              }}
            >
              {state.demo ? "Start my training log" : "Clear my training data"}
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
