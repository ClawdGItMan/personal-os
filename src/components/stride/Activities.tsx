"use client";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  DownloadSimple,
  MagnifyingGlass,
  PersonSimpleRun,
  Plus,
  Timer,
  TrendUp,
} from "@phosphor-icons/react";
import { runDay, duration, formatDay, pace } from "@/lib/stride/training";
import type { Run } from "@/lib/stride/types";
import { useStride } from "./Store";
import { Empty, Tag } from "./ui";

export function downloadFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Activities({
  openRun,
  logRun,
}: {
  openRun: (run: Run) => void;
  logRun: () => void;
}) {
  const { state, navigate } = useStride();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All runs");
  const [source, setSource] = useState("All sources");
  const runs = useMemo(
    () =>
      state.runs.filter(
        (r) =>
          (filter === "All runs" || r.kind === filter) &&
          (source === "All sources" || r.source === source) &&
          `${r.title} ${r.notes} ${r.date}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [state.runs, query, filter, source],
  );
  const distance = runs.reduce((sum, r) => sum + r.distance, 0);
  const seconds = runs.reduce((sum, r) => sum + r.duration, 0);
  function exportCsv() {
    const quote = (value: unknown) =>
      `"${String(value)
        .replace(/"/g, '""')
        .replace(/^[=+@-]/, "'$&")}"`;
    downloadFile(
      "stride-runs.csv",
      [
        [
          "Date",
          "Title",
          "Distance (km)",
          "Duration (seconds)",
          "Average HR",
          "Effort",
          "Source",
        ],
        ...runs.map((r) => [
          r.date,
          r.title,
          r.distance,
          r.duration,
          r.heartRate ?? "",
          r.effort ?? "",
          r.source,
        ]),
      ]
        .map((row) => row.map(quote).join(","))
        .join("\n"),
      "text/csv",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY MILE HAS A STORY</div>
          <h1>Look how far you’ve come.</h1>
          <p>Your running journal, with the details that matter.</p>
        </div>
        <button className="button primary" onClick={logRun}>
          <Plus size={18} />
          Log a run
        </button>
      </div>
      <div className="activity-summary">
        <div>
          <PersonSimpleRun size={23} />
          <span>
            <strong>
              {distance.toFixed(1)} <small>km</small>
            </strong>
            <p>Total distance</p>
          </span>
        </div>
        <div>
          <Timer size={23} />
          <span>
            <strong>
              {Math.floor(seconds / 3600)}
              <small>h</small> {Math.round(seconds / 60) % 60}
              <small>m</small>
            </strong>
            <p>Time on your feet</p>
          </span>
        </div>
        <div>
          <TrendUp size={23} />
          <span>
            <strong>
              {pace({ distance, duration: seconds })}
              <small> /km</small>
            </strong>
            <p>Average moving pace</p>
          </span>
        </div>
        <div>
          <strong>{runs.length}</strong>
          <p>Runs in this view</p>
        </div>
      </div>
      <section className="panel activity-panel">
        <div className="activity-toolbar">
          <div className="search-field">
            <MagnifyingGlass size={18} />
            <input
              aria-label="Search runs"
              placeholder="Find a run…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            aria-label="Filter run type"
            className="small-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              "All runs",
              "Easy run",
              "Tempo run",
              "Intervals",
              "Long run",
              "Recovery run",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter activity source"
            className="small-select"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            {["All sources", "Manual", "Strava", "Apple Health", "Demo"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <button className="button secondary compact" onClick={exportCsv}>
            <DownloadSimple size={16} />
            Export
          </button>
        </div>
        {runs.length ? (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>
                    Activity <ArrowDown size={12} />
                  </th>
                  <th>Distance</th>
                  <th>Time</th>
                  <th>Pace</th>
                  <th>Avg. HR</th>
                  <th>Effort</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <button
                        className="activity-name"
                        onClick={() => openRun(run)}
                      >
                        <span
                          className={`activity-icon ${run.kind === "Tempo run" || run.kind === "Intervals" ? "amber" : ""}`}
                        >
                          <PersonSimpleRun size={23} />
                        </span>
                        <span>
                          <strong>{run.title}</strong>
                          <small>
                            {formatDay(runDay(run))} · {run.source}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <b>{run.distance.toFixed(2)}</b>
                      <small> km</small>
                    </td>
                    <td>{duration(run.duration)}</td>
                    <td>
                      {pace(run)}
                      <small> /km</small>
                    </td>
                    <td>
                      {run.heartRate || "—"}
                      <small>{run.heartRate ? " bpm" : ""}</small>
                    </td>
                    <td>
                      {run.effort ? (
                        <Tag tone={run.effort >= 8 ? "amber" : "green"}>
                          {run.effort}/10
                        </Tag>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => openRun(run)}
                        >
                          Add
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${run.title}`}
                        onClick={() => openRun(run)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              state.runs.length
                ? "No runs found"
                : "Your first mile starts here"
            }
            detail={
              state.runs.length
                ? "Try another search or clear your filters."
                : "Log a run manually or bring your history from Strava or Apple Health."
            }
            action={
              state.runs.length ? "Clear filters" : "Connect your activities"
            }
            onClick={() => {
              if (state.runs.length) {
                setQuery("");
                setFilter("All runs");
                setSource("All sources");
              } else navigate("Connections");
            }}
          />
        )}
        <div className="table-footer">
          <span>
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
          <span>Effort is how it felt, from 1–10.</span>
        </div>
      </section>
    </>
  );
}
