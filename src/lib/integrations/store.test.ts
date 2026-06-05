import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken } from "@/lib/crypto/tokens";
import { readTokens } from "./store";

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
