import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SessionProvider, useSession } from "./src/auth/SessionProvider";
import { TabBar } from "./src/components/spec/TabBar";
import { NavProvider, useNav } from "./src/navigation/NavContext";
import { BodyScreen } from "./src/screens/BodyScreen";
import { CaptureSheet } from "./src/screens/CaptureSheet";
import { DetailScreen } from "./src/screens/DetailScreen";
import { FocusScreen } from "./src/screens/FocusScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MoneyScreen } from "./src/screens/MoneyScreen";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";

/** On web, preview inside a phone-width column so localhost mirrors the device. */
function DeviceFrame({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.webStage}>
      <View style={[styles.webPhone, { borderColor: c.hairSection }]}>{children}</View>
    </View>
  );
}

/** Status bar follows the active mode (Porcelain = dark glyphs, Ivy = light). */
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

/** Themed solid screen fill — the spec has no ambient texture, just bg. */
function ThemedFill() {
  const { c } = useTheme();
  return <View style={[styles.fill, { backgroundColor: c.bg }]} />;
}

/** Renders the active tab's screen. */
function ActiveScreen() {
  const { tab } = useNav();
  if (tab === "body") return <BodyScreen />;
  if (tab === "money") return <MoneyScreen />;
  if (tab === "focus") return <FocusScreen />;
  return <HomeScreen />;
}

/**
 * Nav shell: themed solid background, the active screen, then the TabBar. The
 * overlay host layers on top — Detail sits *under* the nav so the tab bar
 * persists, while the Capture/Assistant sheets sit *over* the nav so their
 * scrims cover the whole screen. State-based, no nav library.
 */
function Shell() {
  const { c } = useTheme();
  const { overlay } = useNav();
  const detailOverlay = overlay?.kind === "detail" ? overlay.item : null;
  const captureOpen = overlay?.kind === "capture";

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ActiveScreen />
      {detailOverlay ? <DetailScreen item={detailOverlay} /> : null}
      <TabBar />
      {captureOpen ? <CaptureSheet /> : null}
      {/* overlay.kind === "assistant": AssistantSheet renders here (screen task B5). */}
      {overlay?.kind === "assistant" ? null : null}
    </View>
  );
}

/** Auth gate: splash while resolving the session, login when signed out, app when in. */
function Root() {
  const { session, loading } = useSession();
  if (loading) return <ThemedFill />;
  if (!session) return <LoginScreen />;
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  return (
    <ThemeProvider>
      <DeviceFrame>
        {fontsLoaded ? (
          <SessionProvider>
            <Root />
          </SessionProvider>
        ) : (
          <ThemedFill />
        )}
        <ThemedStatusBar />
      </DeviceFrame>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  webStage: {
    flex: 1,
    backgroundColor: "#1A1A17", // web preview stage chrome (outside the app surface)
    alignItems: "center",
  },
  webPhone: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
  },
});
