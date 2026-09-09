"use client";
import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  Check,
  CheckCircle,
  FileArrowUp,
  Heart,
  LockKey,
  ArrowsClockwise,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { parseHealthExport } from "@/lib/stride/import";
import { useStride } from "./Store";
import { Tag } from "./ui";

export default function Connections() {
  const { state, addRuns, status, refreshStatus, toast, navigate } =
    useStride();
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function sync() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/stride/strava/sync", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      addRuns(data.runs);
      toast(
        `${data.runs.length} running activities checked and merged.${data.partial ? " The first 500 recent activities were checked." : ""}`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Sync could not finish.",
      );
    } finally {
      setSyncing(false);
    }
  }
  async function importHealth(file: File) {
    setImporting(true);
    setError("");
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error(
          "This export is larger than 100 MB. Use a smaller export of running workouts for this browser importer.",
        );
      const runs = parseHealthExport(await file.text());
      addRuns(runs, true);
      toast(
        `${runs.length} Apple Health runs checked and merged into your history.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The export could not be imported.",
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ONE HOME FOR YOUR RUNNING</div>
          <h1>Bring your miles together.</h1>
          <p>Less time entering data. More time understanding your training.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => void refreshStatus()}
        >
          <ArrowsClockwise size={17} />
          Refresh status
        </button>
      </div>
      {error && (
        <div className="connection-error" role="alert">
          <WarningCircle size={20} />
          {error}
        </div>
      )}
      <div className="connections-grid">
        <section className="panel provider-card">
          <div className="provider-top">
            <span className="provider-logo strava-logo">
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <path d="m16 4 11 20h-7l-4-8-4 8H5L16 4Z" fill="currentColor" />
                <path d="m27 36-8-14h6l2 4 3-4h6l-9 14Z" fill="currentColor" />
              </svg>
            </span>
            <Tag tone={status.stravaConnected ? "green" : "neutral"}>
              {status.stravaConnected ? "Connected" : "Not connected"}
            </Tag>
          </div>
          <h2>Strava</h2>
          <p>
            Your runs, pace, heart rate, and elevation. Connect once, then sync
            your recent activity whenever you’re ready.
          </p>
          <ul className="provider-features">
            <li>
              <Check size={16} />
              Imports your last 90 days of running
            </li>
            <li>
              <Check size={16} />
              Keeps your activity history together
            </li>
            <li>
              <Check size={16} />
              Read-only access to your account
            </li>
          </ul>
          {status.stravaConnected ? (
            <>
              <button
                className="button strava-button full"
                disabled={syncing}
                onClick={() => void sync()}
              >
                <ArrowsClockwise size={18} className={syncing ? "spin" : ""} />
                {syncing ? "Syncing your runs…" : "Sync with Strava"}
              </button>
              <button
                className="text-button disconnect"
                onClick={async () => {
                  const response = await fetch(
                    "/api/stride/strava/disconnect",
                    { method: "POST" },
                  );
                  if (response.ok) {
                    await refreshStatus();
                    toast(
                      "Strava disconnected from this browser. Saved runs remain in your history.",
                    );
                  } else setError("Disconnect failed. Please try again.");
                }}
              >
                Disconnect this browser
              </button>
            </>
          ) : (
            <button
              className="button strava-button full"
              onClick={() => {
                if (status.stravaConfigured)
                  location.href = "/api/stride/strava/connect";
                else setSetup(!setup);
              }}
            >
              Connect with Strava
              <ArrowRight size={17} />
            </button>
          )}
          {setup && (
            <div className="provider-setup">
              <h3>One-time app setup</h3>
              <p>
                Strava app credentials haven’t been configured in this
                workspace. Register your app, then add its client ID and secret
                to the server environment.
              </p>
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noreferrer"
              >
                Open Strava API settings
                <ArrowSquareOut size={15} />
              </a>
              <p className="code-label">
                Callback: /api/stride/strava/callback
              </p>
              <button
                className="text-button"
                onClick={() => void refreshStatus()}
              >
                Check configuration again
              </button>
            </div>
          )}
        </section>
        <section className="panel provider-card">
          <div className="provider-top">
            <span className="provider-logo apple-health-logo">
              <Heart size={38} weight="fill" />
            </span>
            <Tag tone={state.healthImportedAt ? "green" : "neutral"}>
              {state.healthImportedAt ? "Export imported" : "File import"}
            </Tag>
          </div>
          <h2>Apple Health</h2>
          <p>
            Bring running workouts from your Apple Watch into Stride using an
            Apple Health export.
          </p>
          <ul className="provider-features">
            <li>
              <Check size={16} />
              Imports distance, duration, and heart rate
            </li>
            <li>
              <Check size={16} />
              Processes the export in your browser
            </li>
            <li>
              <Check size={16} />
              Merges repeat imports automatically
            </li>
          </ul>
          <button
            className="button primary full"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <FileArrowUp size={18} />
            {importing
              ? "Reading your workouts…"
              : "Import Apple Health export"}
          </button>
          <input
            type="file"
            aria-label="Apple Health export file"
            accept=".xml,application/xml,text/xml"
            ref={fileRef}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importHealth(file);
            }}
          />
          <div className="health-howto">
            <h3>From your iPhone to your training plan</h3>
            <ol>
              <li>Open Health and tap your profile picture.</li>
              <li>Choose “Export All Health Data.”</li>
              <li>
                Unzip the export and choose <b>export.xml</b> here.
              </li>
            </ol>
            <p>
              Direct background syncing needs a native iPhone companion. This
              web version supports XML imports up to 100 MB.
            </p>
            {state.healthImportedAt && (
              <span className="success-label">
                <CheckCircle size={15} />
                Last import{" "}
                {new Date(state.healthImportedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </section>
      </div>
      <section className="connection-privacy">
        <span className="privacy-icon">
          <ShieldCheck size={30} />
        </span>
        <div>
          <h2>Your training data belongs to you.</h2>
          <p>
            Runs and check-ins are saved in this browser. Strava credentials
            stay encrypted on the server side of your browser session. Health
            exports are read locally. Live AI is optional and asks before
            sharing training context.
          </p>
          <button className="text-button" onClick={() => navigate("Settings")}>
            Manage your data
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <div className="connection-explainer">
        <LockKey size={18} />
        <p>
          Connecting an account does not post activities or change your Strava
          workouts. Disconnect here to stop syncing; revoke app access in Strava
          to remove the authorization entirely.
        </p>
      </div>
    </>
  );
}
