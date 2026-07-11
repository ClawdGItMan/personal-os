import * as Haptics from "expo-haptics";
import type { GestureResponderEvent, PressableProps } from "react-native";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Snappy press-in / gentler release — tuned so the scale reads instantly on
 * touch-down but doesn't overshoot back to rest. */
const PRESS_IN_SPRING = { damping: 22, stiffness: 320, mass: 0.4 };
const PRESS_OUT_SPRING = { damping: 20, stiffness: 260, mass: 0.5 };
const PRESSED_SCALE = 0.97;
const PRESSED_OPACITY = 0.92;

export type PressedHaptic = "selection" | "success" | "none";

export type PressedProps = PressableProps & {
  /**
   * "selection" (default) fires `Haptics.selectionAsync()` on pressIn — the
   * standard tactile tick for taps/toggles/navigation. "success" fires
   * nothing on pressIn — use it on buttons that trigger an async write whose
   * *completion* already has its own success branch (task toggle, habit
   * toggle, focus start/end, an assistant `act()` call, a capture
   * confirmation, a money save): call the paired `fireSuccessHaptic()` from
   * that existing success branch instead, so the buzz lands on completion,
   * not on touch-down, and the two never double-fire. "none" fires nothing
   * on pressIn and has no paired completion signal — for controls with no
   * haptic story at all.
   */
  haptic?: PressedHaptic;
};

/**
 * Fire-and-forget success tick — pairs with `<Pressed haptic="success">`.
 * Call this from an *existing* success branch of a write (do not invent a
 * new success/status state just to host this call — see task C1 brief's
 * haptics mapping). No-op-safe to call speculatively; errors from the
 * native module are swallowed like every other expo-haptics call site here.
 */
export function fireSuccessHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Pressed — the app's one press-physics wrapper (task C1: interaction
 * layer). A drop-in `Pressable` substitute: scale 0.97 + opacity 0.92 spring
 * on pressIn, springing back on pressOut/cancel (Reanimated 4), honoring
 * `useReducedMotion` (skips the spring entirely — no animated style is
 * merged in, so a reduced-motion device sees a static, instant press with no
 * scale/opacity change). Forwards every `Pressable` prop (`onPress`,
 * `disabled`, `accessibilityRole`, `hitSlop`, `style`, `children`, …)
 * unchanged, so every existing call site converts by swapping the import —
 * `<Pressable ...>` → `<Pressed ...>` — with no other changes required.
 */
export function Pressed({ haptic = "selection", style, onPressIn, onPressOut, disabled, ...rest }: PressedProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!reduceMotion) {
      scale.value = withSpring(PRESSED_SCALE, PRESS_IN_SPRING);
      opacity.value = withSpring(PRESSED_OPACITY, PRESS_IN_SPRING);
    }
    if (haptic === "selection") void Haptics.selectionAsync();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, PRESS_OUT_SPRING);
      opacity.value = withSpring(1, PRESS_OUT_SPRING);
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      style={reduceMotion ? style : [style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    />
  );
}
