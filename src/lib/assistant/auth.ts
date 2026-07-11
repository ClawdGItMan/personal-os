import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface AuthedClient {
  /** Anon-key client with the caller's JWT bound to its global Authorization
   * header — every query run through this client is RLS-scoped as the user. */
  supabase: SupabaseClient<Database>;
  userId: string;
}

/**
 * Parses `Authorization: Bearer <supabase access_token>` off an incoming
 * `Request`, validates it against Supabase Auth, and returns an anon-key
 * client bound to that token so all subsequent queries run through it are
 * RLS-scoped as the caller — mirrors the mobile app's auth model (see
 * `src/lib/supabase/middleware.ts` for the cookie-session equivalent used by
 * the web app, and the brief's global constraint on mobile→API auth).
 *
 * Returns `null` on any failure (missing/malformed header, missing env,
 * invalid/expired token) — callers should respond 401 in that case.
 *
 * Any route that authenticates this way is a Bearer-auth API route: it MUST
 * be added to the `/api/*` middleware exemption list and covered by a unit
 * test, per the "Middleware gotcha" global constraint. That wiring happens
 * where the route is defined, not here.
 */
export async function getUserClientFromBearer(req: Request): Promise<AuthedClient | null> {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;

  const jwt = header.slice("Bearer ".length).trim();
  if (!jwt) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;

  return { supabase, userId: data.user.id };
}
