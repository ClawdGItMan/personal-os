import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be base64 of 32 bytes");
  return k;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ct, tag].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(payload: string): string {
  const [ivB64, ctB64, tagB64] = payload.split(".");
  if (!ivB64 || !ctB64 || !tagB64) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** SHA-256 of a secret, hex-encoded. Deterministic — used to store/compare the
 *  ingest token. We never need the plaintext back, so this is a hash, not the
 *  AES encrypt path above. */
export function hashToken(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time compare of a presented secret against a stored sha256 hex hash.
 *  Hashes the presented secret first, so both sides are fixed-length 32-byte
 *  digests — timingSafeEqual never sees a length mismatch (no throw, no length
 *  leak). Returns false (never throws) on a malformed stored hash. */
export function compareToken(presentedSecret: string, storedHashHex: string): boolean {
  let storedBuf: Buffer;
  try {
    storedBuf = Buffer.from(storedHashHex, "hex");
  } catch {
    return false;
  }
  if (storedBuf.length !== 32) return false; // malformed stored hash
  const presentedBuf = createHash("sha256").update(presentedSecret, "utf8").digest();
  return timingSafeEqual(presentedBuf, storedBuf);
}
