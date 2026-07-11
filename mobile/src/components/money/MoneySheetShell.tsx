import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CloseIcon } from "../icons";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type MoneySheetShellProps = {
  /** Mono uppercase header label, e.g. "ACCOUNTS" / "TRANSACTION". */
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Local sheet shell shared by AccountEditorSheet + TransactionSheet — a
 * scrim + rising bottom sheet, same choreography as CaptureSheet.tsx (spring
 * translateY, tap-scrim-to-close) but LOCAL to MoneyScreen: rendered from
 * MoneyScreen's own state, not routed through NavContext's overlay system,
 * per the design brief's "keep them simple slide-ups" direction. No BlurView
 * — a flat scrim keeps these lightweight since MoneyScreen may mount two of
 * these in quick succession (list → add-account, row → add-transaction).
 *
 * Hosted in a React Native `Modal` (transparent, animationType="none" — our
 * own translateY/opacity Animated values drive the actual motion, the Modal
 * just supplies the native full-screen host) rather than a plain absolutely-
 * positioned View: MoneyScreen renders this as a normal child, which sits
 * *below* App's TabBar in the Shell's paint order (TabBar renders after the
 * active screen — see App.tsx's Shell), so a plain View here left the tabs
 * tappable through the sheet and a stray tap unmounted MoneyScreen mid-edit.
 * Modal escapes the in-app view hierarchy entirely and paints above
 * everything, including the TabBar, without touching App.tsx/NavContext.
 */
export function MoneySheetShell({ title, onClose, children }: MoneySheetShellProps) {
  const { c } = useTheme();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(rise, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    anim.start();
    return () => anim.stop();
  }, [rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.host}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.sheet, borderColor: c.hairSection },
            { opacity: rise, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.hairSection }]} />

          <View style={[styles.header, { borderColor: c.hairRow }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.dot, { backgroundColor: c.accent }]} />
              <Text style={[styles.headerLabel, { color: c.ink72 }]}>{title}</Text>
            </View>
            <Pressable style={[styles.close, { borderColor: c.hairSection }]} onPress={onClose} hitSlop={8}>
              <CloseIcon size={12} color={c.ink50} strokeWidth={2} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.body}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = Platform.OS === "web" ? 560 : "78%";

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  headerLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 1.9,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flexShrink: 1,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
});
