import { describe, it, expect } from "vitest";
import { mapEvent } from "./calendar";

describe("mapEvent", () => {
  it("maps a timed event", () => {
    const row = mapEvent({
      id: "abc",
      summary: "Standup",
      location: "Zoom",
      start: { dateTime: "2026-06-04T15:00:00Z" },
      end: { dateTime: "2026-06-04T15:30:00Z" },
      status: "confirmed",
    });
    expect(row).toMatchObject({
      external_id: "abc",
      title: "Standup",
      location: "Zoom",
      all_day: false,
      source: "google_calendar",
      starts_at: "2026-06-04T15:00:00Z",
    });
  });

  it("flags all-day events (date, not dateTime)", () => {
    const row = mapEvent({
      id: "d1",
      summary: "Trip",
      start: { date: "2026-06-10" },
      end: { date: "2026-06-11" },
      status: "confirmed",
    });
    expect(row?.all_day).toBe(true);
    expect(row?.starts_at.startsWith("2026-06-10")).toBe(true);
    expect(row?.starts_at).toBe("2026-06-10T00:00:00Z");
  });

  it("defaults a missing title", () => {
    expect(
      mapEvent({
        id: "x",
        start: { dateTime: "2026-06-04T15:00:00Z" },
        status: "confirmed",
      })?.title,
    ).toBe("(no title)");
  });

  it("returns null for cancelled events", () => {
    expect(mapEvent({ id: "x", status: "cancelled", start: {} })).toBeNull();
  });
});
