import { describe, it, expect } from "vitest";

import { isStale, staleAgeLabel } from "./stale";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe("isStale", () => {
  it("is stale when never synced (null)", () => {
    expect(isStale(null)).toBe(true);
  });
  it("is fresh within the threshold", () => {
    expect(isStale(minutesAgo(5))).toBe(false);
  });
  it("is stale past the threshold", () => {
    expect(isStale(minutesAgo(60), 30)).toBe(true);
  });
  it("is stale for an unparseable timestamp", () => {
    expect(isStale("not-a-date")).toBe(true);
  });
});

describe("staleAgeLabel", () => {
  it("labels null as never", () => {
    expect(staleAgeLabel(null)).toBe("never");
  });
  it("labels minutes", () => {
    expect(staleAgeLabel(minutesAgo(5))).toMatch(/^\d+m$/);
  });
  it("labels hours", () => {
    expect(staleAgeLabel(minutesAgo(3 * 60))).toBe("3h");
  });
  it("labels days", () => {
    expect(staleAgeLabel(minutesAgo(2 * 24 * 60))).toBe("2d");
  });
});
