/** Uniform server-action return type. Never throw raw errors to the client. */
export type ActionResult = { ok: true } | { ok: false; error: string };
