import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from "@expo-google-fonts/instrument-serif";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { AmbientBackground } from "./src/components/AmbientBackground";
import { BottomNav } from "./src/components/BottomNav";
import { NavProvider, useNav } from "./src/navigation/NavContext";
import { BodyScreen } from "./src/screens/BodyScreen";
import { CaptureSheet } from "./src/screens/CaptureSheet";
import { DetailScreen } from "./src/screens/DetailScreen";
import { FocusScreen } from "./src/screens/FocusScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MoneyScreen } from "./src/screens/MoneyScreen";
import { color } from "./src/theme/tokens";

/** On web, preview inside a phone-width column so localhost mirrors the device. */
function DeviceFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.webStage}>
      <View style={styles.webPhone}>{children}</View>
    </View>
  );
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
 * Nav shell (spec §3): a fixed AmbientBackground, the active screen, then the
 * BottomNav. The overlay host layers on top — Detail sits *under* the nav so the
 * tab bar persists (spec §5.5), while the Capture sheet sits *over* the nav so
 * its scrim covers the whole screen (spec §5.6). State-based, no nav library.
 */
function Shell() {
  const { tab, setTab, openCapture, overlay } = useNav();
  const detailOverlay = overlay?.kind === "detail" ? overlay.item : null;
  const captureOpen = overlay?.kind === "capture";
  return (
    <View style={styles.shell}>
      <AmbientBackground />
      <ActiveScreen />
      {detailOverlay ? <DetailScreen item={detailOverlay} /> : null}
      <BottomNav active={tab} onTab={setTab} onCapture={openCapture} />
      {captureOpen ? <CaptureSheet /> : null}
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });

  if (!fontsLoaded) return <View style={styles.loading} />;

  return (
    <DeviceFrame>
      <NavProvider>
        <Shell />
      </NavProvider>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: color.bg,
  },
  webStage: {
    flex: 1,
    backgroundColor: "#08090C",
    alignItems: "center",
  },
  webPhone: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: color.line2,
    overflow: "hidden",
  },
});
