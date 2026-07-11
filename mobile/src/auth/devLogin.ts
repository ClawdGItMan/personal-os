import { supabase } from "../lib/supabase";

/**
 * DEV-ONLY simulator auto-login. When a dev bundle (__DEV__) has
 * EXPO_PUBLIC_DEV_LOGIN_EMAIL / EXPO_PUBLIC_DEV_LOGIN_PASSWORD set
 * (mobile/.env — gitignored), signs that user in automatically so screens
 * behind the auth gate can be verified on the simulator without the
 * email-OTP dance (rate-limited, needs a mailbox). The seeded fixture user
 * lives in scripts/dev/seed-sim-user.sql. Release builds strip __DEV__
 * branches — this cannot run in production.
 */
export async function tryDevLogin(): Promise<void> {
  if (!__DEV__) return;
  const email = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD;
  if (!email || !password) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) console.warn("[devLogin] sign-in failed:", error.message);
}
