import "server-only";
import { cookies } from "next/headers";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import { z } from "zod";

export const stravaCookie = "stride_strava";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/stride",
  maxAge: 60 * 60 * 24 * 30,
};
export const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().positive(),
});
export type StravaTokens = z.infer<typeof tokenSchema>;
export function stravaConfigured() {
  return Boolean(
    process.env.STRAVA_CLIENT_ID &&
    process.env.STRAVA_CLIENT_SECRET &&
    Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64").length === 32,
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function readStravaTokens(): Promise<StravaTokens | null> {
  try {
    const value = (await cookies()).get(stravaCookie)?.value;
    return value ? tokenSchema.parse(JSON.parse(decryptToken(value))) : null;
  } catch {
    return null;
  }
}
export async function writeStravaTokens(tokens: StravaTokens) {
  (await cookies()).set(
    stravaCookie,
    encryptToken(JSON.stringify(tokens)),
    cookieOptions,
  );
}
export async function exchangeStrava(
  params: Record<string, string>,
): Promise<StravaTokens> {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      ...params,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "Strava authorization failed. Please reconnect your account.",
    );
  return tokenSchema.parse(await response.json());
}
