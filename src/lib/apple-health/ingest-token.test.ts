import { describe, it, expect } from "vitest";
import { mintIngestToken, splitIngestToken } from "./ingest-token";

describe("mintIngestToken", () => {
  it("returns { token, secret, secretHash } with token = `${userId}.${secret}`", () => {
    const { token, secret, secretHash } = mintIngestToken("11111111-1111-1111-1111-111111111111");
    expect(token).toBe(`11111111-1111-1111-1111-111111111111.${secret}`);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{20,}$/); // base64url, no padding
    expect(secretHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("mints a different secret each call", () => {
    const a = mintIngestToken("u1"); const b = mintIngestToken("u1");
    expect(a.secret).not.toBe(b.secret);
  });
});

describe("splitIngestToken", () => {
  it("splits on the FIRST dot into { userId, secret }", () => {
    expect(splitIngestToken("u1.abc.def")).toEqual({ userId: "u1", secret: "abc.def" });
  });
  it("returns null for a token with no dot or empty halves", () => {
    expect(splitIngestToken("nodot")).toBeNull();
    expect(splitIngestToken(".secret")).toBeNull();
    expect(splitIngestToken("user.")).toBeNull();
    expect(splitIngestToken("")).toBeNull();
  });
  it("strips a leading 'Bearer ' so the route can pass the raw header value", () => {
    expect(splitIngestToken("Bearer u1.secret")).toEqual({ userId: "u1", secret: "secret" });
  });
});
