import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "../lib/supabase";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

type Status = "idle" | "sending" | "sent" | "verifying" | "error";

/**
 * Email OTP sign-in (spec §7 auth). Sends a Supabase magic-link email that also
 * carries a 6-digit code ({{ .Token }} in the email template); the user types
 * the code here and `verifyOtp` completes the session — no deep link needed
 * (iOS mail apps won't open custom-scheme links). The web/link path still works
 * as a fallback via SessionProvider's auth-callback handling.
 */
export function LoginScreen() {
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const valid = /.+@.+\..+/.test(email.trim());
  const codeValid = /^\d{6}$/.test(code.trim());

  async function verifyCode() {
    if (!codeValid) return;
    setStatus("verifying");
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (err) {
      setStatus("sent");
      setError(err.message);
      return;
    }
    // Session lands via SessionProvider's onAuthStateChange — nothing else to do.
  }

  async function sendLink() {
    if (!valid) return;
    setStatus("sending");
    setError("");
    // Web: return to the app root (the Expo dev server always serves it) with the
    // token in the query. Native: the `personalos://auth-callback` deep link.
    const emailRedirectTo =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin
        : Linking.createURL("auth-callback");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    });
    if (err) {
      setStatus("error");
      setError(err.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.body}>
        <View style={styles.brandRow}>
          <View style={[styles.brandDot, { backgroundColor: c.accent }]} />
          <Text style={[styles.brand, { color: c.ink72 }]}>MAX OS</Text>
        </View>

        {status === "sent" || status === "verifying" ? (
          <View style={styles.block}>
            <Text style={[styles.title, { color: c.ink }]}>
              Check your <Text style={[styles.emphasis, { color: c.ink }]}>email.</Text>
            </Text>
            <Text style={[styles.sub, { color: c.ink64 }]}>
              Enter the 6-digit code sent to {email.trim()}.
            </Text>

            <TextInput
              style={[styles.field, styles.codeField, { backgroundColor: c.surface, borderColor: c.hairSection, color: c.ink }]}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={c.ink38}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              onSubmitEditing={verifyCode}
              returnKeyType="go"
              autoFocus
            />

            {error ? <Text style={[styles.error, { color: c.red }]}>{error}</Text> : null}

            <Pressable
              style={[
                styles.button,
                { backgroundColor: c.accent },
                (!codeValid || status === "verifying") && styles.buttonDisabled,
              ]}
              onPress={verifyCode}
              disabled={!codeValid || status === "verifying"}
            >
              {status === "verifying" ? (
                <ActivityIndicator color={c.onAccent} size="small" />
              ) : (
                <Text style={[styles.buttonLabel, { color: c.onAccent }]}>Verify code</Text>
              )}
            </Pressable>

            <Pressable onPress={() => { setStatus("idle"); setCode(""); setError(""); }} hitSlop={8}>
              <Text style={[styles.link, { color: c.accent }]}>Use a different email</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={[styles.title, { color: c.ink }]}>
              Good to see you, <Text style={[styles.emphasis, { color: c.ink }]}>Max.</Text>
            </Text>
            <Text style={[styles.sub, { color: c.ink64 }]}>Sign in with a magic link — no password.</Text>

            <TextInput
              style={[styles.field, { backgroundColor: c.surface, borderColor: c.hairSection, color: c.ink }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={c.ink38}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              onSubmitEditing={sendLink}
              returnKeyType="go"
            />

            {status === "error" ? <Text style={[styles.error, { color: c.red }]}>{error}</Text> : null}

            <Pressable
              style={[
                styles.button,
                { backgroundColor: c.accent },
                (!valid || status === "sending") && styles.buttonDisabled,
              ]}
              onPress={sendLink}
              disabled={!valid || status === "sending"}
            >
              {status === "sending" ? (
                <ActivityIndicator color={c.onAccent} size="small" />
              ) : (
                <Text style={[styles.buttonLabel, { color: c.onAccent }]}>Send sign-in code</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => { if (valid) { setStatus("sent"); setError(""); } }}
              disabled={!valid}
              hitSlop={8}
            >
              <Text style={[styles.link, { color: valid ? c.accent : c.ink38 }]}>I already have a code</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "web" ? 72 : 108,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  brand: {
    fontFamily: fonts.mono500,
    fontSize: 11,
    letterSpacing: 1.54,
  },
  block: {
    marginTop: 64,
  },
  title: {
    fontFamily: fonts.sans600,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  emphasis: {
    fontFamily: fonts.sans700,
  },
  sub: {
    fontFamily: fonts.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 26,
  },
  field: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: fonts.sans500,
    fontSize: 15,
  },
  codeField: {
    fontFamily: fonts.mono600,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
  },
  error: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 10,
  },
  button: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  link: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 22,
  },
});
