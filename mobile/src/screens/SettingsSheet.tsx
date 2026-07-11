import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useSession } from "../auth/SessionProvider";
import { SettingsRow, StatusDot } from "../components/settings/SettingsRow";
import { SettingsSection } from "../components/settings/SettingsSection";
import { ToggleRow } from "../components/settings/ToggleRow";
import { FieldLabel, FormError, SheetPrimaryButton, SheetTextField } from "../components/money/MoneyFormControls";
import { formatCompact } from "../components/money/format";
import { ChevronIcon, CloseIcon, LockIcon } from "../components/icons";
import { fireSuccessHaptic, Pressed } from "../components/spec/Pressed";
import {
  cancelMorningBrief,
  ensureNotificationPermission,
  getMorningBriefEnabled,
  scheduleMorningBrief,
} from "../lib/notifications";
import { useMoney } from "../lib/queries";
import { useDeviceCalendar } from "../lib/queries/useDeviceCalendar";
import { useIntegrationsStatus } from "../lib/queries/useIntegrationsStatus";
import type { IntegrationDot } from "../lib/queries/useIntegrationsStatus";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { layout } from "../theme/layout";
import { fonts } from "../theme/typeRoles";

/** Fully offscreen starting offset — comfortably below any device height,
 * matches AssistantSheet.tsx's own sheet host constants exactly. */
const SHEET_TRAVEL = 900;
/** Downward drag past this many px on release dismisses the sheet. */
const DRAG_DISMISS_PX = 100;
const SPRING = { damping: 19, stiffness: 140, mass: 0.9 };
/** How long the ACCOUNT section's "TAP AGAIN TO SIGN OUT" confirm affordance
 * stays up — same window as Focus's LiveTimerBand end-confirm. */
const CONFIRM_SIGNOUT_MS = 3000;

function dotColor(dot: IntegrationDot, c: { accent: string; amber: string; red: string }): string {
  if (dot === "green") return c.accent;
  if (dot === "amber") return c.amber;
  return c.red;
}

/**
 * Settings sheet (task C3) — signed-in account + sign out, the Morning Brief
 * notification toggle, device-calendar picker, read-only integration health,
 * the money budget editor, and app/about info. Opened from ScreenHeader's
 * MAX OS wordmark tap. Sheet chrome is a direct mirror of AssistantSheet.tsx
 * (slide-up spring, scrim, grabber drag-dismiss, KeyboardAvoidingView) —
 * duplicated rather than shared since AssistantSheet doesn't export its
 * layout constants/pan logic for reuse and this task's file scope doesn't
 * include touching that file.
 */
export function SettingsSheet() {
  const { c, t } = useTheme();
  const { close } = useNav();
  const { session, signOut } = useSession();
  const money = useMoney();
  const deviceCal = useDeviceCalendar();
  const integrations = useIntegrationsStatus();

  const translateY = useSharedValue(SHEET_TRAVEL);
  const scrim = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING);
    scrim.value = withTiming(1, { duration: 280 });
  }, [translateY, scrim]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.value = g.dy;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_DISMISS_PX) close();
        else translateY.value = withSpring(0, SPRING);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  // Guards setState-after-unmount for the async handlers below (sign out,
  // budget save) — mirrors AssistantSheet's isMountedRef note: App.tsx
  // unmounts this sheet immediately on dismiss/close, and a successful sign
  // out itself tears down the whole NavProvider tree (Root swaps to
  // LoginScreen) potentially mid-await.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ---- ACCOUNT: sign out (tap-again confirm, no Alert — same idiom as
  // Focus's LiveTimerBand end-confirm) ----
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (signOutConfirmTimer.current) clearTimeout(signOutConfirmTimer.current);
    };
  }, []);

  const performSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      if (!isMountedRef.current) return;
      setSignOutError(err instanceof Error ? err.message : "Couldn't sign out");
    } finally {
      if (isMountedRef.current) setSigningOut(false);
    }
  }, [signOut]);

  function handleSignOutPress() {
    if (signingOut) return;
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      setSignOutError(null);
      if (signOutConfirmTimer.current) clearTimeout(signOutConfirmTimer.current);
      signOutConfirmTimer.current = setTimeout(() => setConfirmingSignOut(false), CONFIRM_SIGNOUT_MS);
      return;
    }
    if (signOutConfirmTimer.current) clearTimeout(signOutConfirmTimer.current);
    setConfirmingSignOut(false);
    void performSignOut();
  }

  // ---- MORNING BRIEF ----
  const [briefEnabled, setBriefEnabled] = useState(false);
  const [briefLoaded, setBriefLoaded] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefNote, setBriefNote] = useState<string | null>(null);

  useEffect(() => {
    void getMorningBriefEnabled().then((enabled) => {
      if (!isMountedRef.current) return;
      setBriefEnabled(enabled);
      setBriefLoaded(true);
    });
  }, []);

  const handleBriefToggle = useCallback(async (next: boolean) => {
    setBriefBusy(true);
    setBriefNote(null);
    try {
      if (next) {
        const status = await ensureNotificationPermission();
        if (status !== "granted") {
          if (isMountedRef.current) setBriefNote("NOTIFICATIONS ARE OFF FOR THIS APP — ENABLE IN IOS SETTINGS");
          return;
        }
        const scheduled = await scheduleMorningBrief();
        if (!isMountedRef.current) return;
        setBriefEnabled(scheduled);
        if (!scheduled) setBriefNote("COULDN'T SCHEDULE — TRY AGAIN");
      } else {
        await cancelMorningBrief();
        if (isMountedRef.current) setBriefEnabled(false);
      }
    } finally {
      if (isMountedRef.current) setBriefBusy(false);
    }
  }, []);

  // ---- DEVICE CALENDARS ----
  const selectedCalendarIds = new Set(deviceCal.selectedIds);
  const toggleCalendar = useCallback(
    (id: string, next: boolean) => {
      const ids = next ? [...deviceCal.selectedIds, id] : deviceCal.selectedIds.filter((x) => x !== id);
      void deviceCal.setSelectedIds(ids);
    },
    [deviceCal],
  );

  // ---- MONEY: monthly budget ----
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  function startEditBudget() {
    setBudgetInput(money.budgetAmount != null ? String(money.budgetAmount) : "");
    setBudgetError(null);
    setBudgetEditing(true);
  }

  async function saveBudget() {
    const parsed = Number(budgetInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || savingBudget) return;
    setSavingBudget(true);
    setBudgetError(null);
    // useMoney's setBudget THROWS on failure — catch here so a failed save
    // renders an inline error and keeps the editor open (same write contract
    // MoneyScreen.saveBudget follows).
    try {
      await money.setBudget(parsed);
      if (!isMountedRef.current) return;
      fireSuccessHaptic();
      setBudgetEditing(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      setBudgetError(err instanceof Error ? err.message : "Couldn't save budget");
    } finally {
      if (isMountedRef.current) setSavingBudget(false);
    }
  }

  const budgetInputValid = Number.isFinite(Number(budgetInput)) && Number(budgetInput) > 0;

  // ---- ABOUT ----
  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: c.scrim }]}>
        {/* Full-bleed dismiss scrim — no visible surface to give press
            physics to, and a haptic tick on "tap outside to close" would
            read as noise, so this stays a plain Pressable (matches
            AssistantSheet/CaptureSheet/MoneySheetShell). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss settings" />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: c.sheet }]}>
        <View {...pan.panHandlers} style={styles.grabberZone}>
          <View style={[styles.grabber, { backgroundColor: c.ink28 }]} />
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.headerLabel, { color: c.ink }]}>SETTINGS</Text>
            <Pressed
              accessibilityLabel="Close settings"
              onPress={close}
              style={[styles.closeCircle, { borderColor: c.hairSection }]}
            >
              <CloseIcon size={12} color={c.ink64} />
            </Pressed>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <SettingsSection title="ACCOUNT" index={1}>
              <SettingsRow label={session?.user.email ?? "—"} sub="SIGNED IN" first />
              <SettingsRow
                label={confirmingSignOut ? "TAP AGAIN TO SIGN OUT" : "SIGN OUT"}
                labelColor={confirmingSignOut ? c.red : c.accent}
                onPress={handleSignOutPress}
                disabled={signingOut}
              />
              {signOutError ? (
                <View style={styles.inlineNoteWrap}>
                  <FormError>{signOutError}</FormError>
                </View>
              ) : null}
            </SettingsSection>

            <SettingsSection title="MORNING BRIEF" index={2}>
              <ToggleRow
                label="MORNING BRIEF"
                sub="7:30 AM · LOCAL"
                value={briefEnabled}
                onChange={(next) => void handleBriefToggle(next)}
                disabled={briefBusy || !briefLoaded}
                first
              />
              {briefNote ? (
                <View style={styles.inlineNoteWrap}>
                  <Text style={[styles.inlineNote, { color: c.ink50 }]}>{briefNote}</Text>
                </View>
              ) : null}
            </SettingsSection>

            <SettingsSection title="DEVICE CALENDARS" index={3}>
              {deviceCal.loading ? (
                <Text style={[styles.quiet, { color: c.ink50 }]}>Loading…</Text>
              ) : deviceCal.permission !== "granted" ? (
                <SettingsRow
                  label="ALLOW CALENDAR ACCESS"
                  sub="SEE DEVICE EVENTS IN FOCUS + HOME"
                  variant="cta"
                  onPress={() => void deviceCal.requestAccess()}
                  right={<LockIcon size={13} color={c.accent} />}
                  first
                />
              ) : deviceCal.calendars.length === 0 ? (
                <Text style={[styles.quiet, { color: c.ink50 }]}>No calendars found on this device.</Text>
              ) : (
                deviceCal.calendars.map((cal, i) => (
                  <ToggleRow
                    key={cal.id}
                    label={cal.title}
                    sub={cal.source || undefined}
                    value={selectedCalendarIds.has(cal.id)}
                    onChange={(next) => toggleCalendar(cal.id, next)}
                    first={i === 0}
                  />
                ))
              )}
              {deviceCal.error ? (
                <View style={styles.inlineNoteWrap}>
                  <FormError>{deviceCal.error}</FormError>
                </View>
              ) : null}
            </SettingsSection>

            <SettingsSection title="INTEGRATIONS" index={4} caption="MANAGE ON WEB">
              {integrations.loading ? (
                <Text style={[styles.quiet, { color: c.ink50 }]}>Loading…</Text>
              ) : (
                integrations.items.map((item, i) => (
                  <SettingsRow
                    key={item.provider}
                    label={item.label}
                    sub={item.sub}
                    first={i === 0}
                    right={<StatusDot color={dotColor(item.dot, c)} />}
                  />
                ))
              )}
              {integrations.error ? (
                <View style={styles.inlineNoteWrap}>
                  <FormError>{integrations.error}</FormError>
                </View>
              ) : null}
            </SettingsSection>

            <SettingsSection title="MONEY" index={5}>
              {budgetEditing ? (
                <View style={[styles.budgetEdit, { borderTopColor: c.hairSection }]}>
                  <FieldLabel>MONTHLY BUDGET</FieldLabel>
                  <SheetTextField
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    numeric
                    autoFocus
                  />
                  {budgetError ? <FormError>{budgetError}</FormError> : null}
                  <View style={styles.budgetActions}>
                    <Pressed
                      onPress={() => {
                        setBudgetError(null);
                        setBudgetEditing(false);
                      }}
                      hitSlop={8}
                      style={styles.budgetCancel}
                    >
                      <Text style={[styles.budgetCancelText, { color: c.ink50 }]}>CANCEL</Text>
                    </Pressed>
                    <View style={styles.budgetSaveWrap}>
                      <SheetPrimaryButton label="Save" onPress={() => void saveBudget()} disabled={!budgetInputValid} loading={savingBudget} />
                    </View>
                  </View>
                </View>
              ) : (
                <SettingsRow
                  label="MONTHLY BUDGET"
                  sub={money.budgetAmount == null ? "NOT SET" : formatCompact(money.budgetAmount)}
                  onPress={startEditBudget}
                  right={<ChevronIcon size={13} color={c.ink34} />}
                  first
                />
              )}
            </SettingsSection>

            <SettingsSection title="ABOUT" index={5}>
              <SettingsRow label="VERSION" sub={appVersion} first />
              <SettingsRow label="IVY / PORCELAIN — CLAUDE DESIGN" />
            </SettingsSection>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "86%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  grabberZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
  },
  headerLabel: {
    fontFamily: fonts.mono500,
    fontSize: 10,
    letterSpacing: 3,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: 4,
    paddingBottom: 32,
  },
  quiet: {
    fontFamily: fonts.sans500,
    fontSize: 13,
    paddingVertical: 14,
  },
  inlineNoteWrap: {
    marginTop: 8,
  },
  inlineNote: {
    fontFamily: fonts.mono500,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    lineHeight: 13,
  },
  budgetEdit: {
    borderTopWidth: 1,
    paddingTop: 15,
    paddingBottom: 4,
  },
  budgetActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 4,
  },
  budgetCancel: {
    paddingVertical: 8,
  },
  budgetCancelText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  budgetSaveWrap: {
    width: 120,
  },
});
