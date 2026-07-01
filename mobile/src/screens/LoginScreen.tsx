import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AmbientBackground } from "../components/AmbientBackground";
import { supabase } from "../lib/supabase";
import { color, font, radius, space, type as t } from "../theme/tokens";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Magic-link sign-in (spec §7 auth). Sends a token-hash link via Supabase; the
 * link reopens the app at the `auth-callback` redirect, where SessionProvider
 * completes it. On-brand: ambient depth, serif wordmark, one blue action.
 */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const valid = /.+@.+\..+/.test(email.trim());

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
    <View style={styles.screen}>
      <AmbientBackground />
      <View style={styles.body}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={t.brand}>MAX OS</Text>
        </View>

        {status === "sent" ? (
          <View style={styles.block}>
            <Text style={styles.title}>
              Check your <Text style={styles.italic}>email.</Text>
            </Text>
            <Text style={styles.sub}>
              A sign-in link is on its way to {email.trim()}. Tap it to open the app.
            </Text>
            <Pressable onPress={() => setStatus("idle")} hitSlop={8}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.title}>
              Good to see you, <Text style={styles.italic}>Max.</Text>
            </Text>
            <Text style={styles.sub}>Sign in with a magic link — no password.</Text>

            <TextInput
              style={styles.field}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={color.fg4}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              onSubmitEditing={sendLink}
              returnKeyType="go"
            />

            {status === "error" ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, (!valid || status === "sending") && styles.buttonDisabled]}
              onPress={sendLink}
              disabled={!valid || status === "sending"}
            >
              {status === "sending" ? (
                <ActivityIndicator color={color.bg} size="small" />
              ) : (
                <Text style={styles.buttonLabel}>Send sign-in link</Text>
              )}
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
    backgroundColor: color.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: space.gutter,
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
    backgroundColor: color.blue,
    shadowColor: color.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 7,
    shadowOpacity: 0.7,
  },
  block: {
    marginTop: 64,
  },
  title: {
    ...t.screenTitle,
  },
  italic: {
    ...t.screenTitleItalic,
  },
  sub: {
    ...t.whisper,
    marginTop: 12,
    marginBottom: 26,
  },
  field: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line2,
    paddingHorizontal: 16,
    color: color.fg1,
    fontFamily: font.sans,
    fontSize: 15,
  },
  error: {
    ...t.rowSub,
    color: color.yellow,
    marginTop: 10,
  },
  button: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: color.blue,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    fontFamily: font.monoBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: color.bg,
    textTransform: "uppercase",
  },
  link: {
    ...t.rowSub,
    color: color.blue,
    marginTop: 22,
  },
});
