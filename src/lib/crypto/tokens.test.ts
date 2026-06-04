import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "./tokens";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("token encryption", () => {
  it("round-trips a value", () => {
    const secret = "ya29.some-google-access-token";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });
  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });
  it("throws on tampered ciphertext", () => {
    const enc = encryptToken("x");
    const tampered = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
    expect(() => decryptToken(tampered)).toThrow();
  });
});
