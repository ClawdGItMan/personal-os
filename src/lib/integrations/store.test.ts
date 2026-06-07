import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { buildRefreshUpdate, buildSaveUpsert, readTokens } from "./store";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("readTokens", () => {
  it("decrypts access and refresh tokens from a row", () => {
    const accessToken = "ya29.some-google-access-token";
    const refreshToken = "1//refresh-token-value";
    const row = {
      access_token: encryptToken(accessToken),
      refresh_token: encryptToken(refreshToken),
    };

    expect(readTokens(row)).toEqual({ accessToken, refreshToken });
  });

  it("returns null tokens when columns are null", () => {
    expect(readTokens({ access_token: null, refresh_token: null })).toEqual({
      accessToken: null,
      refreshToken: null,
    });
  });

  it("decrypts access token while refresh token is absent", () => {
    const accessToken = "ya29.only-access";
    const row = { access_token: encryptToken(accessToken), refresh_token: null };

    expect(readTokens(row)).toEqual({ accessToken, refreshToken: null });
  });
});

describe("buildRefreshUpdate", () => {
  it("encrypts the new access token and merges metadata, NOT replacing it", () => {
    const upd = buildRefreshUpdate({ whoop_user_id: 42, expires_at: 1 }, { accessToken: "at2", expiresAt: 999 });
    expect(decryptToken(upd.access_token as string)).toBe("at2");
    expect(upd.metadata).toEqual({ whoop_user_id: 42, expires_at: 999 });
    expect("refresh_token" in upd).toBe(false); // omitted when not rotated (Google)
  });
  it("includes the rotated refresh token when provided (Whoop)", () => {
    const upd = buildRefreshUpdate({}, { accessToken: "at2", refreshToken: "rt2", expiresAt: 999 });
    expect(decryptToken(upd.refresh_token as string)).toBe("rt2");
  });
});

describe("buildSaveUpsert", () => {
  it("sets status connected, last_error null, both encrypted tokens, and metadata", () => {
    const row = buildSaveUpsert("u1", "whoop", { accessToken: "at", refreshToken: "rt", expiresAt: 5 }, { whoop_user_id: 7 });
    expect(row).toMatchObject({ user_id: "u1", provider: "whoop", status: "connected", last_error: null });
    expect(decryptToken(row.access_token as string)).toBe("at");
    expect(decryptToken(row.refresh_token as string)).toBe("rt");
    // authoritative expires_at wins even if extraMetadata tries to set it
    expect(row.metadata).toMatchObject({ whoop_user_id: 7, expires_at: 5 });
  });
});
