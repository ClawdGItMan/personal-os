import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "./database.types";
import { secureStorage } from "./secureStorage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy mobile/.env.example to mobile/.env.",
  );
}

const isWeb = Platform.OS === "web";

/**
 * The one Supabase client for the app — a new client of the same backend the
 * web app uses (spec §7). Session persistence differs by platform: native keeps
 * it in the OS keychain/keystore (encrypted, via secureStorage); web uses the
 * default localStorage. We drive the token-hash magic-link redirect ourselves
 * (see auth/), so `detectSessionInUrl` stays off.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: isWeb ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
