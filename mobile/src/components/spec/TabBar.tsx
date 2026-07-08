import type { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useNav } from "../../navigation/NavContext";
import type { TabKey } from "../../navigation/NavContext";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { IconBody, IconDollar, IconHome, IconLamp, IconPlus } from "./iconsSpec";

type IconComponent = ComponentType<{ size?: number; color: string; strokeWidth?: number }>;

const LEFT: { id: TabKey; label: string; Icon: IconComponent }[] = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "body", label: "Body", Icon: IconBody },
];
const RIGHT: { id: TabKey; label: string; Icon: IconComponent }[] = [
  { id: "money", label: "Money", Icon: IconDollar },
  { id: "focus", label: "Focus", Icon: IconLamp },
];

function Tab({ id, label, Icon }: { id: TabKey; label: string; Icon: IconComponent }) {
  const { c, t } = useTheme();
  const { tab, setTab } = useNav();
  const active = tab === id;
  return (
    <Pressable style={styles.tab} onPress={() => setTab(id)}>
      <View style={[styles.tick, active && { backgroundColor: c.accent }]} />
      <Icon size={20} color={active ? c.ink : c.tabInactive} />
      <Text style={[t.tabLabel, active && { color: c.ink72 }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Tab bar (design README §Spacing & structure): top hairline, five slots —
 * Home, Body, center 50×50 r14 capture button, Money, Focus. Active tab wears
 * a 16×2 accent tick above an ink icon; inactive slots sit at tabInactive.
 */
export function TabBar() {
  const { c } = useTheme();
  const { openCapture } = useNav();
  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.hairSection }]}>
      <View style={styles.slots}>
        {LEFT.map((tab) => (
          <Tab key={tab.id} {...tab} />
        ))}
        <Pressable
          accessibilityLabel="Quick capture"
          onPress={openCapture}
          style={[
            styles.capture,
            { backgroundColor: c.captureBg, borderColor: c.captureRing, shadowColor: c.ink },
          ]}
        >
          <IconPlus size={20} color={c.ink} />
        </Pressable>
        {RIGHT.map((tab) => (
          <Tab key={tab.id} {...tab} />
        ))}
      </View>
      {Platform.OS === "web" ? (
        // iOS draws its own home indicator; the spec's 134×5 bar renders on the web preview only.
        <View style={[styles.indicator, { backgroundColor: c.indicator }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
  },
  slots: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 14,
  },
  tab: {
    width: 48,
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
  },
  tick: {
    width: 16,
    height: 2,
    borderRadius: layout.radius.pill,
    backgroundColor: "transparent",
  },
  capture: {
    width: 50,
    height: 50,
    borderRadius: layout.radius.capture,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    shadowOpacity: 0.1,
    ...(Platform.OS === "android" ? { elevation: 4 } : null),
  },
  indicator: {
    width: 134,
    height: 5,
    borderRadius: layout.radius.pill,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 3,
  },
});
