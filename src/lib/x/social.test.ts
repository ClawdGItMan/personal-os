import { describe, it, expect } from "vitest";
import { mapFollowerCount } from "./social";

describe("mapFollowerCount", () => {
  it("extracts a positive followers_count", () => {
    expect(
      mapFollowerCount({ data: { id: "1", username: "max", public_metrics: { followers_count: 1234, following_count: 50, tweet_count: 9, listed_count: 2 } } }),
    ).toBe(1234);
  });
  it("returns 0 for a real zero count (a valid value, not a skip)", () => {
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: 0 } } })).toBe(0);
  });
  it("returns null when public_metrics is missing (skip the write — don't clobber)", () => {
    expect(mapFollowerCount({ data: { id: "1", username: "max" } })).toBeNull();
  });
  it("returns null when followers_count is missing/non-numeric/negative", () => {
    expect(mapFollowerCount({ data: { public_metrics: {} } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: "1234" as unknown as number } } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: Number.NaN } } })).toBeNull();
    expect(mapFollowerCount({ data: { public_metrics: { followers_count: -5 } } })).toBeNull();
  });
  it("returns null on a malformed/empty response", () => {
    expect(mapFollowerCount({})).toBeNull();
    expect(mapFollowerCount(null as unknown as object)).toBeNull();
  });
});
