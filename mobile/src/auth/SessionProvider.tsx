import type { EmailOtpType, Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";

import { supabase } from "../lib/supabase";

type SessionValue = {
  session: Session | null;
  /** True until the initial session lookup resolves (avoids a login flash). */
  loading: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "invite", "recovery", "email_change", "email"];

/**
 * Owns the Supabase auth session for the whole app (spec §7 — the native app is
 * a new client of the same backend). Loads the persisted session, subscribes to
 * auth changes, and completes the token-hash magic-link flow when the app is
 * opened via its redirect (a `personalos://` deep link on native, or the
 * localhost URL on web).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const url = Linking.useURL();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!url) return;
    const { queryParams } = Linking.parse(url);
    const tokenHash = queryParams?.token_hash;
    const rawType = queryParams?.type;
    if (typeof tokenHash !== "string" || typeof rawType !== "string") return;
    if (!OTP_TYPES.includes(rawType as EmailOtpType)) return;

    void supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType }).then(({ error }) => {
      // Strip the one-time token from the web URL bar once consumed.
      if (!error && Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
  }, [url]);

  const value: SessionValue = {
    session,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
