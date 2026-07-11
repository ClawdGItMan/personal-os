import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { AlsoSeeing } from "../components/assistant/AlsoSeeing";
import { AskBar } from "../components/assistant/AskBar";
import { AssistantHeader } from "../components/assistant/AssistantHeader";
import { Briefing } from "../components/assistant/Briefing";
import { ChatThread, useAssistantChat } from "../components/assistant/ChatThread";
import { SheetFadeUp } from "../components/assistant/SheetFadeUp";
import { SuggestionChips } from "../components/assistant/SuggestionChips";
import { TopMove } from "../components/assistant/TopMove";
import type { TopMoveStatus } from "../components/assistant/TopMove";
import { Skeleton } from "../components/spec/Skeleton";
import { assistantConfig } from "../data/assistant";
import type { SeeingItem } from "../data/assistant";
import {
  AssistantApiError,
  AssistantNotConfiguredError,
  AssistantOfflineError,
  AssistantUnauthorizedError,
  act,
  getBrief,
} from "../lib/assistant/api";
import type { AssistantAlsoSeeing, BriefEnvelope } from "../lib/assistant/api";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { layout } from "../theme/layout";
import { fonts } from "../theme/typeRoles";

/** Fully offscreen starting offset — comfortably below any device height. */
const SHEET_TRAVEL = 900;
/** Downward drag past this many px on release dismisses the sheet. */
const DRAG_DISMISS_PX = 100;
const SPRING = { damping: 19, stiffness: 140, mass: 0.9 };
/** How long the TOP MOVE band shows its ✓ + summary state before the sheet auto-dismisses. */
const APPLY_SUCCESS_DISMISS_MS = 1200;

type BriefState = "loading" | "ready" | "not_configured" | "offline" | "error";
type Mode = "brief" | "chat";

/** Shared copy/formatting for both the top-move and also-seeing `act()` error paths. */
function actErrorMessage(err: unknown): string {
  if (err instanceof AssistantOfflineError) return "YOU'RE OFFLINE";
  if (err instanceof AssistantNotConfiguredError) return "ASSISTANT NOT CONFIGURED";
  if (err instanceof AssistantUnauthorizedError) return "SESSION EXPIRED — SIGN IN AGAIN";
  if (err instanceof AssistantApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "SOMETHING WENT WRONG";
}

/** Maps the live `also_seeing` row + its local `act()` state onto SeeingRow's UI shape. */
function toSeeingItem(
  raw: AssistantAlsoSeeing,
  state: { status: SeeingItem["status"]; errorMessage?: string } | undefined,
): SeeingItem {
  return {
    tag: raw.domain,
    title: raw.title,
    sub: raw.sub,
    action: raw.actionLabel,
    actionTone: raw.tool ? "accent" : "neutral",
    tool: raw.tool,
    args: raw.args,
    status: state?.status ?? "idle",
    errorMessage: state?.errorMessage,
  };
}

/**
 * Assistant sheet (design README §Assistant sheet, spec 8a) — the spark
 * button's context-aware overlay. Slides up over a scrim (translateY spring
 * ~550ms) above the TabBar, same host pattern as CaptureSheet.
 *
 * Two views share this one sheet (brief B6): **brief** (skeleton → real
 * `getBrief()` briefing/top-move/also-seeing + suggestion chips) and **chat**
 * (a `ChatThread`, entered by sending from the ask bar or a suggestion chip).
 * The header + ask bar are common chrome; only the body between them swaps.
 */
export function AssistantSheet() {
  const { c } = useTheme();
  const { close, setTab } = useNav();
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

  // ---- Unmount guards ----
  // App.tsx unmounts this sheet immediately on dismiss; `actAbortRef` cancels
  // any in-flight `act()` call (APPLY / also-seeing) rather than let it keep
  // running after the user has left, and `isMountedRef` guards every setState
  // that follows an `await` so a stale response never updates a torn-down
  // component (mirrors `useAssistantChat`'s / useCaptureSession's
  // unmount-abort pattern).
  const isMountedRef = useRef(true);
  const actAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    actAbortRef.current = controller;
    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, []);

  // ---- Brief (headline/body/top-move/also-seeing) ----
  const [briefState, setBriefState] = useState<BriefState>("loading");
  const [briefErrorMessage, setBriefErrorMessage] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<BriefEnvelope | null>(null);

  const loadBrief = useCallback(async () => {
    setBriefState("loading");
    setBriefErrorMessage(null);
    try {
      const env = await getBrief();
      setEnvelope(env);
      setBriefState("ready");
    } catch (err) {
      if (err instanceof AssistantNotConfiguredError) setBriefState("not_configured");
      else if (err instanceof AssistantOfflineError) setBriefState("offline");
      else {
        setBriefErrorMessage(err instanceof Error ? err.message : "Couldn't load your brief");
        setBriefState("error");
      }
    }
  }, []);

  useEffect(() => {
    void loadBrief();
  }, [loadBrief]);

  // ---- Top move (APPLY / LATER) ----
  const [topMoveStatus, setTopMoveStatus] = useState<TopMoveStatus>("idle");
  const [topMoveSummary, setTopMoveSummary] = useState<string | null>(null);
  const [topMoveError, setTopMoveError] = useState<string | null>(null);
  const [topMoveCollapsed, setTopMoveCollapsed] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleApplyTopMove = useCallback(async () => {
    const topMove = envelope?.brief.topMove;
    if (!topMove) return;
    setTopMoveStatus("pending");
    setTopMoveError(null);
    try {
      const result = await act(topMove.tool, topMove.args, actAbortRef.current?.signal);
      if (!isMountedRef.current) return;
      setTopMoveSummary(result.summary);
      setTopMoveStatus("success");
      dismissTimerRef.current = setTimeout(() => close(), APPLY_SUCCESS_DISMISS_MS);
    } catch (err) {
      if (!isMountedRef.current) return;
      setTopMoveStatus("error");
      setTopMoveError(actErrorMessage(err));
    }
  }, [envelope, close]);

  // ---- Also seeing (per-row act() or VIEW navigation) ----
  const [rowStates, setRowStates] = useState<Record<number, { status: SeeingItem["status"]; errorMessage?: string }>>({});

  const handleAlsoSeeingAction = useCallback(
    async (item: SeeingItem, index: number) => {
      if (item.tool) {
        setRowStates((prev) => ({ ...prev, [index]: { status: "pending" } }));
        try {
          await act(item.tool, item.args ?? {}, actAbortRef.current?.signal);
          if (!isMountedRef.current) return;
          setRowStates((prev) => ({ ...prev, [index]: { status: "success" } }));
        } catch (err) {
          if (!isMountedRef.current) return;
          setRowStates((prev) => ({ ...prev, [index]: { status: "error", errorMessage: actErrorMessage(err) } }));
        }
        return;
      }
      if (item.action === "VIEW") {
        close();
        setTab("money");
      }
    },
    [close, setTab],
  );

  // ---- Chat mode ----
  const [mode, setMode] = useState<Mode>("brief");
  const chat = useAssistantChat();

  // Gate the TOP MOVE success auto-dismiss on the sheet still being in brief
  // mode — if the user enters chat (e.g. sends a message) while the timer is
  // pending, cancel it so APPLY's success state doesn't yank them out of the
  // conversation they just started.
  useEffect(() => {
    if (mode !== "brief" && dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, [mode]);

  const handleSend = useCallback(
    (text: string) => {
      setMode("chat");
      chat.sendMessage(text);
    },
    [chat],
  );

  const showActionable = briefState === "ready";
  const showAskBar = briefState !== "not_configured";
  const showChips = briefState !== "not_configured" && mode === "brief";
  const topMove = envelope?.brief.topMove ?? null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss assistant" />
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
            <SheetFadeUp index={0}>
              <AssistantHeader onClose={close} />
            </SheetFadeUp>
            {mode === "chat" ? (
              <Pressable onPress={() => setMode("brief")} hitSlop={8} style={styles.backRow}>
                <Text style={[styles.backLink, { color: c.accent }]}>← BRIEF</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.scrollArea}>
            {mode === "brief" ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets
              >
                <SheetFadeUp index={1} style={styles.section}>
                  {briefState === "loading" ? (
                    <View style={styles.briefSkeleton}>
                      <Skeleton width="70%" height={18} />
                      <Skeleton width="100%" height={13} />
                      <Skeleton width="55%" height={13} />
                    </View>
                  ) : briefState === "not_configured" ? (
                    <Text style={[styles.quietState, { color: c.ink50 }]}>
                      ASSISTANT NOT CONFIGURED — ADD AN API KEY ON THE SERVER
                    </Text>
                  ) : briefState === "offline" ? (
                    <View>
                      <Text style={[styles.quietState, { color: c.ink50 }]}>YOU'RE OFFLINE</Text>
                      <Pressable onPress={loadBrief} hitSlop={8} style={styles.retryRow}>
                        <Text style={[styles.retryLink, { color: c.accent }]}>RETRY</Text>
                      </Pressable>
                    </View>
                  ) : briefState === "error" ? (
                    <View>
                      <Text style={[styles.errorState, { color: c.red }]}>
                        {(briefErrorMessage ?? "COULDN'T LOAD YOUR BRIEF").toUpperCase()}
                      </Text>
                      <Pressable onPress={loadBrief} hitSlop={8} style={styles.retryRow}>
                        <Text style={[styles.retryLink, { color: c.accent }]}>RETRY</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Briefing headline={envelope!.brief.headline} body={envelope!.brief.body} />
                  )}
                </SheetFadeUp>

                {briefState === "loading" ? (
                  <SheetFadeUp index={2} style={styles.bandSection}>
                    <View style={[styles.bandSkeleton, { borderColor: c.hairSection }]}>
                      <Skeleton width={100} height={9} />
                      <Skeleton width={220} height={15} radius={3} />
                      <Skeleton width={160} height={9} />
                      <View style={styles.bandSkeletonActions}>
                        <Skeleton width={78} height={32} radius={layout.radius.pill} />
                        <Skeleton width={78} height={32} radius={layout.radius.pill} />
                      </View>
                    </View>
                  </SheetFadeUp>
                ) : showActionable && topMove && !topMoveCollapsed ? (
                  <SheetFadeUp index={2} style={styles.bandSection}>
                    <TopMove
                      tag={topMove.tag}
                      title={topMove.title}
                      evidence={topMove.evidence}
                      status={topMoveStatus}
                      summary={topMoveSummary}
                      errorMessage={topMoveError}
                      onApply={handleApplyTopMove}
                      onLater={() => setTopMoveCollapsed(true)}
                    />
                  </SheetFadeUp>
                ) : null}

                {briefState === "loading" ? (
                  <SheetFadeUp index={3} style={styles.section}>
                    <View style={styles.seeingSkeletonHeader}>
                      <Skeleton width={92} height={11} />
                    </View>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[styles.seeingSkeletonRow, { borderTopColor: i === 0 ? c.hairSection : c.hairRow }]}
                      >
                        <Skeleton width={40} height={9} />
                        <View style={styles.seeingSkeletonBody}>
                          <Skeleton width="70%" height={13} />
                          <Skeleton width="40%" height={9} />
                        </View>
                        <Skeleton width={54} height={24} radius={12} />
                      </View>
                    ))}
                  </SheetFadeUp>
                ) : showActionable && envelope ? (
                  <SheetFadeUp index={3} style={styles.section}>
                    <AlsoSeeing
                      items={envelope.brief.alsoSeeing.map((raw, i) => toSeeingItem(raw, rowStates[i]))}
                      onAction={handleAlsoSeeingAction}
                    />
                  </SheetFadeUp>
                ) : null}

                {showChips ? (
                  <SheetFadeUp index={4} style={styles.section}>
                    <SuggestionChips items={assistantConfig.suggestions} onSelect={handleSend} />
                  </SheetFadeUp>
                ) : null}
              </ScrollView>
            ) : (
              <SheetFadeUp index={1} style={styles.scroll}>
                <ChatThread
                  messages={chat.messages}
                  historyLoading={chat.historyLoading}
                  historyError={chat.historyError}
                  onRetryHistory={chat.retryHistory}
                  onRetry={chat.retry}
                />
              </SheetFadeUp>
            )}
          </View>

          {showAskBar ? (
            <SheetFadeUp index={5} style={styles.askBarWrap}>
              <AskBar onSend={handleSend} sending={chat.sending} onStop={chat.stop} />
            </SheetFadeUp>
          ) : null}
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
    paddingHorizontal: layout.gutter,
  },
  backRow: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  backLink: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: 4,
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
  },
  bandSection: {
    marginTop: 20,
    marginHorizontal: -layout.gutter,
  },
  briefSkeleton: {
    gap: 8,
  },
  bandSkeleton: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: layout.bandPadV,
    paddingHorizontal: layout.gutter,
    gap: 9,
  },
  bandSkeletonActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  seeingSkeletonHeader: {
    marginBottom: 4,
  },
  seeingSkeletonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  seeingSkeletonBody: {
    flex: 1,
    gap: 6,
    marginTop: 1,
  },
  quietState: {
    fontFamily: fonts.mono500,
    fontSize: 10.5,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  errorState: {
    fontFamily: fonts.mono500,
    fontSize: 9.5,
    letterSpacing: 0.6,
    lineHeight: 15,
    textTransform: "uppercase",
  },
  retryRow: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  retryLink: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  askBarWrap: {
    paddingHorizontal: layout.gutter,
    paddingTop: 12,
    paddingBottom: 18,
  },
});
