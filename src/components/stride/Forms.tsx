"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  Moon,
  PersonSimpleRun,
} from "@phosphor-icons/react";
import {
  runDay,
  dayKey,
  duration,
  formatDay,
  pace,
} from "@/lib/stride/training";
import type { Run, RunKind, Session } from "@/lib/stride/types";
import { useStride } from "./Store";
import { Modal, Tag, SessionIcon } from "./ui";
import { runInsight } from "@/lib/stride/insights";

export function LogRun({
  close,
  existing,
  session,
}: {
  close: () => void;
  existing?: Run;
  session?: Session;
}) {
  const { state, setState, addRuns, toast } = useStride();
  const [effort, setEffort] = useState(existing?.effort ?? 4);
  const [pain, setPain] = useState(existing?.pain ?? false);
  const [error, setError] = useState("");
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const distance = Number(data.get("distance"));
    const minutes = Number(data.get("minutes"));
    const date = String(data.get("date"));
    const hrValue = Number(data.get("heartRate"));
    if (
      !Number.isFinite(distance) ||
      distance < 0.1 ||
      distance > 200 ||
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      minutes > 1800 ||
      date > dayKey() ||
      !date
    ) {
      setError(
        "Add a valid date, distance (0.1–200 km), and duration (1–1,800 minutes).",
      );
      return;
    }
    if (hrValue && (hrValue < 30 || hrValue > 240)) {
      setError("Heart rate should be between 30 and 240 bpm, or left blank.");
      return;
    }
    const run: Run = {
      id: existing?.id || `manual-${crypto.randomUUID()}`,
      title: String(data.get("title")).trim() || "My run",
      date:
        existing && runDay(existing) === date
          ? existing.date
          : `${date}T${String(data.get("time")) || "07:00"}:00`,
      distance,
      duration: Math.round(minutes * 60),
      heartRate: hrValue || null,
      elevation: Number(data.get("elevation")) || 0,
      effort,
      pain,
      notes: String(data.get("notes")),
      kind: String(data.get("kind")) as RunKind,
      source:
        existing?.source === "Demo" ? "Manual" : existing?.source || "Manual",
    };
    if (existing)
      setState((previous) =>
        previous
          ? {
              ...previous,
              runs: previous.runs.filter((r) => r.id !== existing.id),
            }
          : previous,
      );
    addRuns([run]);
    toast(
      existing
        ? "Run updated. Your training has been reviewed."
        : "Run saved. Another step toward your starting line.",
    );
    close();
  }
  return (
    <Modal
      title={existing ? "Reflect on your run" : "Every run counts."}
      subtitle="The numbers tell one story. How you felt tells the rest."
      close={close}
      wide
    >
      <form onSubmit={save} className="stride-form">
        {state.demo && (
          <div className="info-note">
            Saving your first real run starts your personal log and removes the
            sample activities.
          </div>
        )}
        <label>
          Run title
          <input
            name="title"
            defaultValue={existing?.title || session?.title || ""}
            placeholder="A good morning on the trails"
            maxLength={100}
          />
        </label>
        <div className="form-grid">
          <label>
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={existing ? runDay(existing) : dayKey()}
              max={dayKey()}
            />
          </label>
          <label>
            Start time
            <input
              name="time"
              type="time"
              defaultValue={existing?.date.slice(11, 16) || "07:00"}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Distance · km
            <input
              name="distance"
              type="number"
              step="0.01"
              min="0.1"
              max="200"
              required
              defaultValue={existing?.distance || session?.distance || ""}
              placeholder="8.00"
            />
          </label>
          <label>
            Duration · minutes
            <input
              name="minutes"
              type="number"
              step="0.1"
              min="1"
              max="1800"
              required
              defaultValue={
                existing ? Math.round(existing.duration / 6) / 10 : ""
              }
              placeholder="48"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Run type
            <select
              name="kind"
              defaultValue={
                existing?.kind ||
                (session?.distance ? session.kind : "Easy run")
              }
            >
              {[
                "Easy run",
                "Tempo run",
                "Intervals",
                "Long run",
                "Recovery run",
              ].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <label>
            Average heart rate · optional
            <input
              name="heartRate"
              type="number"
              min="30"
              max="240"
              defaultValue={existing?.heartRate || ""}
              placeholder="bpm"
            />
          </label>
        </div>
        <label>
          Elevation gain · meters
          <input
            name="elevation"
            type="number"
            min="0"
            max="20000"
            defaultValue={existing?.elevation || ""}
            placeholder="Optional"
          />
        </label>
        <label>
          How hard did it feel?{" "}
          <span className="range-value">
            {effort}/10 ·{" "}
            {effort <= 3 ? "Easy" : effort <= 6 ? "Moderate" : "Hard"}
          </span>
          <input
            aria-label="Perceived effort"
            type="range"
            min="1"
            max="10"
            value={effort}
            onChange={(event) => setEffort(Number(event.target.value))}
          />
          <span className="range-labels">
            <span>Very easy</span>
            <span>Maximum effort</span>
          </span>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={pain}
            onChange={(event) => setPain(event.target.checked)}
          />
          I felt pain or discomfort that affected my run
        </label>
        <label>
          Anything to remember?
          <textarea
            name="notes"
            defaultValue={existing?.notes}
            maxLength={1500}
            placeholder="Legs, energy, fueling, the little wins…"
            rows={3}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            <Check size={17} />
            Save run
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function CheckinForm({ close }: { close: () => void }) {
  const { state, saveCheckin } = useStride();
  const existing = state.checkins.find((c) => c.date === dayKey());
  const [energy, setEnergy] = useState(existing?.energy || 4);
  const [soreness, setSoreness] = useState(existing?.soreness || 0);
  const [pain, setPain] = useState(existing?.pain || false);
  return (
    <Modal
      title="How’s your body today?"
      subtitle="A 30-second check-in for a plan that listens."
      close={close}
    >
      <form
        className="stride-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          saveCheckin({
            date: dayKey(),
            energy,
            soreness,
            sleep: Number(data.get("sleep")),
            pain,
          });
          close();
        }}
      >
        <fieldset className="energy-fieldset">
          <legend>Energy level</legend>
          <div className="energy-options">
            {["Drained", "Low", "Okay", "Good", "Great"].map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={energy === i + 1}
                className={energy === i + 1 ? "selected" : ""}
                onClick={() => setEnergy(i + 1)}
              >
                <span>{i + 1}</span>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="inline-icon">
            <Moon size={17} />
            Hours of sleep
          </span>
          <input
            name="sleep"
            type="number"
            required
            min="0"
            max="16"
            step="0.1"
            defaultValue={existing?.sleep ?? 7.5}
          />
        </label>
        <label>
          Muscle soreness <span className="range-value">{soreness}/10</span>
          <input
            type="range"
            aria-label="Muscle soreness"
            min="0"
            max="10"
            value={soreness}
            onChange={(event) => setSoreness(Number(event.target.value))}
          />
          <span className="range-labels">
            <span>None</span>
            <span>Very sore</span>
          </span>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={pain}
            onChange={(event) => setPain(event.target.checked)}
          />
          I have pain, not just general muscle soreness
        </label>
        {pain && (
          <div className="info-note amber">
            Pause activities that hurt. If pain persists, worsens, or changes
            how you move, check with a qualified clinician.
          </div>
        )}
        <button className="button primary full" type="submit">
          Save my check-in
          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
export function SessionDetail({
  session,
  close,
  log,
}: {
  session: Session;
  close: () => void;
  log: (session: Session) => void;
}) {
  const { navigate } = useStride();
  return (
    <Modal
      title={session.title}
      subtitle={formatDay(session.date, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      close={close}
    >
      <div className="workout-detail">
        <span
          className={`session-icon ${session.kind === "Tempo run" ? "amber" : ""}`}
        >
          <SessionIcon kind={session.kind} size={30} />
        </span>
        <Tag>{session.kind}</Tag>
        <div className="detail-numbers">
          <strong>{session.distance || session.minutes || "Rest"}</strong>
          {session.distance ? (
            <span>kilometers</span>
          ) : session.minutes ? (
            <span>minutes</span>
          ) : null}
        </div>
        <p>{session.description}</p>
        {session.distance > 0 && (
          <div className="workout-steps">
            <div>
              <span>01</span>
              <p>
                <b>Ease into it</b>Start gently and check how your legs feel.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <b>Find your rhythm</b>Let today’s effort guide your pace.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <b>Finish & reflect</b>Cool down, refuel, and record how it
                felt.
              </p>
            </div>
          </div>
        )}
        <button
          className="button primary full"
          onClick={() => {
            if (session.distance && session.date <= dayKey()) log(session);
            else {
              close();
              navigate(
                session.kind === "Strength"
                  ? "Strength & recovery"
                  : "AI coach",
              );
            }
          }}
        >
          {session.distance && session.date <= dayKey()
            ? "Log this workout"
            : session.kind === "Strength"
              ? "Open strength session"
              : "Talk it through with coach"}
          <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
export function RunDetail({
  run,
  close,
  edit,
}: {
  run: Run;
  close: () => void;
  edit: (run: Run) => void;
}) {
  const { state, setState, toast } = useStride();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const insight = runInsight(run, state.runs);
  return (
    <Modal
      title={run.title}
      subtitle={`${formatDay(runDay(run), { weekday: "long", month: "long", day: "numeric" })} · ${run.source}`}
      close={close}
    >
      <div className="run-detail">
        <Tag>{run.kind}</Tag>
        <div className="run-detail-metrics">
          <div>
            <PersonSimpleRun size={22} />
            <strong>{run.distance.toFixed(2)}</strong>
            <span>kilometers</span>
          </div>
          <div>
            <strong>{pace(run)}</strong>
            <span>pace /km</span>
          </div>
          <div>
            <strong>{duration(run.duration)}</strong>
            <span>moving time</span>
          </div>
        </div>
        <div className="detail-row">
          <span>
            <Heart size={17} />
            Average heart rate
          </span>
          <b>{run.heartRate ? `${run.heartRate} bpm` : "Not recorded"}</b>
        </div>
        <div className="detail-row">
          <span>Perceived effort</span>
          <b>{run.effort ? `${run.effort}/10` : "Add your reflection"}</b>
        </div>
        <div className="detail-row">
          <span>Elevation gain</span>
          <b>{run.elevation} m</b>
        </div>
        {run.notes && <p className="run-notes">{run.notes}</p>}
        {run.pain && (
          <div className="info-note amber">
            You reported pain on this run. Review recovery before your next
            workout.
          </div>
        )}
        <section className="run-insight">
          <span className="small-kicker">YOUR RUN IN CONTEXT</span>
          <h3>{insight.title}</h3>
          <p>{insight.body}</p>
          <b>{insight.question}</b>
        </section>
        <button className="button primary full" onClick={() => edit(run)}>
          Edit run & reflection
          <ArrowRight size={17} />
        </button>
        <button
          className="text-button danger"
          onClick={() => {
            if (!confirmDelete) setConfirmDelete(true);
            else {
              setState((previous) =>
                previous
                  ? {
                      ...previous,
                      runs: previous.runs.filter((r) => r.id !== run.id),
                    }
                  : previous,
              );
              toast("Run deleted.");
              close();
            }
          }}
        >
          {confirmDelete ? "Confirm: delete this run" : "Delete run"}
        </button>
      </div>
    </Modal>
  );
}
