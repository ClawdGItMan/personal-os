import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/crypto/tokens";

/** Mint a new ingest token for a user.
 *  Token format: `<userId>.<secret>` where secret is randomBytes(32) base64url.
 *  Only the secretHash is stored in integrations.metadata.token_hash — the
 *  plaintext token is shown once at generation time and never persisted. */
export function mintIngestToken(userId: string): {
  token: string;
  secret: string;
  secretHash: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const secretHash = hashToken(secret);
  const token = `${userId}.${secret}`;
  return { token, secret, secretHash };
}

/** Split a raw Authorization header value (or bare token) into { userId, secret }.
 *  Strips an optional "Bearer " prefix, then splits on the FIRST dot.
 *  Returns null if the token is missing, has no dot, or either half is empty. */
export function splitIngestToken(raw: string): { userId: string; secret: string } | null {
  if (!raw) return null;
  const stripped = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  const dotIndex = stripped.indexOf(".");
  if (dotIndex === -1) return null;
  const userId = stripped.slice(0, dotIndex);
  const secret = stripped.slice(dotIndex + 1);
  if (!userId || !secret) return null;
  return { userId, secret };
}
