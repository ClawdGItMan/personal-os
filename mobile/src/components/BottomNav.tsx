import { BlurView } from "expo-blur";
import type { ComponentType } from "react";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { TabKey } from "../navigation/NavContext";
import { color, glow, type } from "../theme/tokens";
import { BodyIcon, FocusIcon, HomeIcon, MoneyIcon, PlusIcon } from "./icons";

export type { TabKey };

type IconComponent = ComponentType<{ size?: number; color: string }>;

/** Each destination owns a color from the system palette — icon carries its hue. */
const TABS: { id: TabKey; label: string; Icon: IconComponent; accent: string }[] = [
  { id: "home", label: "Home", Icon: HomeIcon, accent: color.blue },
  { id: "body", label: "Body", Icon: BodyIcon, accent: color.green },
  { id: "money", label: "Money", Icon: MoneyIcon, accent: color.yellow },
  { id: "focus", label: "Focus", Icon: FocusIcon, accent: color.fg1 },
];

type TabProps = {
  label: string;
  Icon: IconComponent;
  accent: string;
  active: boolean;
  onPress: () => void;
};

function Tab({ label, Icon, accent, active, onPress }: TabProps) {
  const breath = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    breath.value = active
      ? withRepeat(
          withSequence(
            withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        )
      : withTiming(1, { duration: 200 });
  }, [active, breath]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value * press.value }],
  }));

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.84, { damping: 14, stiffness: 300 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 10, stiffness: 220 });
      }}
    >
      <Animated.View style={[iconStyle, active && glow(accent, 9, 0.55)]}>
        <View style={!active && styles.iconDim}>
          <Icon color={accent} />
        </View>
      </Animated.View>
      <Text style={[type.navLabel, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Bottom tab bar with the center ⊕ Capture spine (spec §3) — translucent,
 * 16px blur, hairline top. The FAB is raised −12px and is not a tab.
 * Active icon breathes (one ambient loop); press gives a spring pop.
 */
type BottomNavProps = {
  active: TabKey;
  onTab: (tab: TabKey) => void;
  onCapture: () => void;
};

export function BottomNav({ active, onTab, onCapture }: BottomNavProps) {
  const [home, body, money, focus] = TABS;
  return (
    <View style={styles.bar}>
      <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <Tab label={home.label} Icon={home.Icon} accent={home.accent} active={active === "home"} onPress={() => onTab("home")} />
      <Tab label={body.label} Icon={body.Icon} accent={body.accent} active={active === "body"} onPress={() => onTab("body")} />
      <Pressable style={[styles.fab, glow(color.blue, 20, 0.35)]} onPress={onCapture}>
        <PlusIcon size={22} color={color.bg} />
      </Pressable>
      <Tab label={money.label} Icon={money.Icon} accent={money.accent} active={active === "money"} onPress={() => onTab("money")} />
      <Tab label={focus.label} Icon={focus.Icon} accent={focus.accent} active={active === "focus"} onPress={() => onTab("focus")} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70 + (Platform.OS === "ios" ? 14 : 0),
    borderTopWidth: 1,
    borderColor: color.line1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14 + (Platform.OS === "ios" ? 14 : 0),
    overflow: "visible",
  },
  scrim: {
    backgroundColor: "rgba(14,16,20,0.82)",
  },
  tab: {
    alignItems: "center",
    gap: 5,
  },
  iconDim: {
    opacity: 0.4,
  },
  labelActive: {
    color: color.fg1,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: color.blue,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -12 }],
  },
});
