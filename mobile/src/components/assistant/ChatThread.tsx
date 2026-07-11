import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AssistantAbortedError,
  AssistantApiError,
  AssistantNotConfiguredError,
  AssistantOfflineError,
  AssistantUnauthorizedError,
  streamChat,
} from "../../lib/assistant/api";
import type { ChatMessageInput, ChatSource } from "../../lib/assistant/api";
import { supabase } from "../../lib/supabase";
import { Pressed } from "../spec/Pressed";
import { Skeleton } from "../spec/Skeleton";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { fonts } from "../../theme/typeRoles";

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------

/** One tool call's lifecycle within a live assistant turn, deduped by
 * `toolCallId` — the SSE stream emits several sub-events per call
 * (`tool-input-start` → `tool-input-delta`* → `tool-input-available` →
 * `tool-output-available`/`tool-output-error`); this collapses them into a
 * single confirmation row that upgrades in place instead of one row per event. */
type ToolSegment = {
  kind: "tool";
  id: string;
  toolCallId: string;
  name: string;
  status: "running" | "done" | "error";
  errorText?: string;
};

type TextSegment = { kind: "text"; id: string; text: string };

type TurnSegment = TextSegment | ToolSegment;

export type ChatEntry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; segments: TurnSegment[]; streaming: boolean }
  | { id: string; kind: "error"; message: string };

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function describeError(err: unknown): string {
  if (err instanceof AssistantOfflineError) return "YOU'RE OFFLINE";
  if (err instanceof AssistantNotConfiguredError) return "ASSISTANT NOT CONFIGURED";
  if (err instanceof AssistantUnauthorizedError) return "SESSION EXPIRED — SIGN IN AGAIN";
  if (err instanceof AssistantApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "SOMETHING WENT WRONG";
}

function toolLabel(name: string): string {
  return name.replace(/_/g, " ").toUpperCase();
}

// ---------------------------------------------------------------------------
// Session controller
// ---------------------------------------------------------------------------

/**
 * Chat session controller (brief B6) — owns the live message list, the
 * growing `{role, content}` context sent to `streamChat`, and the one-time
 * load of the last 20 `agent_messages` rows (RLS-scoped direct read,
 * ordered oldest-first) shown above the live exchange. Lives here rather
 * than in `AssistantSheet` so the sheet stays a thin orchestrator: it only
 * decides *when* to call `sendMessage` (ask bar submit, a suggestion chip)
 * and *which view* is visible — the session itself, and its history,
 * persist across a brief↔chat toggle because this hook's state lives for
 * the sheet's whole mount, not the toggle (the sheet only mounts this hook
 * once, at the top of its own component body).
 */
export function useAssistantChat(source: ChatSource = "MAX_OS") {
  const [historyEntries, setHistoryEntries] = useState<ChatEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [liveEntries, setLiveEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);

  const historyLoadedRef = useRef(false);
  const apiMessagesRef = useRef<ChatMessageInput[]>([]);
  const lastUserTextRef = useRef<string | null>(null);
  const lastAssistantIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** False once the sheet has unmounted (dismissed mid-turn) — guards every
   * setState after an `await` so a stale stream never updates state on a
   * component React has already torn down. */
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Dismissing the sheet unmounts this hook immediately; abort whatever
      // streamChat turn is still in flight rather than let it keep running
      // (and billing) after the user has already left (mirrors
      // useCaptureSession's unmount-abort pattern).
      abortRef.current?.abort();
    };
  }, []);

  const loadHistoryOnce = useCallback(async () => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from("agent_messages")
        .select("id, role, text, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data ?? []).slice().reverse();
      setHistoryEntries(
        rows.reduce<ChatEntry[]>((acc, row) => {
          if (row.role === "user") {
            acc.push({ id: row.id, kind: "user", text: row.text });
          } else if (row.role === "assistant") {
            acc.push({
              id: row.id,
              kind: "assistant",
              streaming: false,
              segments: row.text ? [{ kind: "text", id: `${row.id}-t`, text: row.text }] : [],
            });
          }
          return acc;
        }, []),
      );
    } catch (err) {
      historyLoadedRef.current = false; // allow a retry to try again
      setHistoryError(err instanceof Error ? err.message : "Couldn't load chat history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const appendTextToAssistant = useCallback((id: string, delta: string) => {
    setLiveEntries((prev) =>
      prev.map((e) => {
        if (e.kind !== "assistant" || e.id !== id) return e;
        const last = e.segments[e.segments.length - 1];
        if (last && last.kind === "text") {
          const updated: TextSegment = { ...last, text: last.text + delta };
          return { ...e, segments: [...e.segments.slice(0, -1), updated] };
        }
        const seg: TextSegment = { kind: "text", id: nextId("seg"), text: delta };
        return { ...e, segments: [...e.segments, seg] };
      }),
    );
  }, []);

  const upsertToolSegment = useCallback(
    (id: string, toolCallId: string, patch: { name?: string; status?: ToolSegment["status"]; errorText?: string }) => {
      setLiveEntries((prev) =>
        prev.map((e) => {
          if (e.kind !== "assistant" || e.id !== id) return e;
          const idx = e.segments.findIndex((s) => s.kind === "tool" && s.toolCallId === toolCallId);
          if (idx === -1) {
            const seg: ToolSegment = {
              kind: "tool",
              id: nextId("tool"),
              toolCallId,
              name: patch.name ?? "tool",
              status: patch.status ?? "running",
              errorText: patch.errorText,
            };
            return { ...e, segments: [...e.segments, seg] };
          }
          const seg = e.segments[idx] as ToolSegment;
          const segments = e.segments.slice();
          segments[idx] = { ...seg, ...patch };
          return { ...e, segments };
        }),
      );
    },
    [],
  );

  const setStreaming = useCallback((id: string, streaming: boolean) => {
    setLiveEntries((prev) => prev.map((e) => (e.kind === "assistant" && e.id === id ? { ...e, streaming } : e)));
  }, []);

  const runAssistantTurn = useCallback(async () => {
    const assistantId = nextId("asst");
    lastAssistantIdRef.current = assistantId;
    const controller = new AbortController();
    abortRef.current = controller;
    setLiveEntries((prev) => [...prev, { id: assistantId, kind: "assistant", segments: [], streaming: true }]);
    setSending(true);
    try {
      const finalText = await streamChat(
        apiMessagesRef.current,
        source,
        (delta) => appendTextToAssistant(assistantId, delta),
        (part) => {
          const p = part as { type?: string; toolCallId?: string; toolName?: string; errorText?: string };
          if (!p.toolCallId) return;
          if (p.type === "tool-input-start") {
            upsertToolSegment(assistantId, p.toolCallId, { name: p.toolName, status: "running" });
          } else if (p.type === "tool-output-available") {
            upsertToolSegment(assistantId, p.toolCallId, { status: "done" });
          } else if (p.type === "tool-output-error" || p.type === "tool-input-error") {
            upsertToolSegment(assistantId, p.toolCallId, { status: "error", errorText: p.errorText });
          }
        },
        { signal: controller.signal },
      );
      if (!isMountedRef.current) return;
      apiMessagesRef.current = [...apiMessagesRef.current, { role: "assistant", content: finalText }];
      setStreaming(assistantId, false);
    } catch (err) {
      if (!isMountedRef.current) return;
      setStreaming(assistantId, false);
      // A deliberate cancel (stop button, or the sheet unmounting) is a
      // silent end, not an error row — whatever partial text/tool rows
      // already rendered just stay as-is.
      if (!(err instanceof AssistantAbortedError)) {
        setLiveEntries((prev) => [...prev, { id: nextId("err"), kind: "error", message: describeError(err) }]);
      }
    } finally {
      abortRef.current = null;
      if (isMountedRef.current) setSending(false);
    }
  }, [appendTextToAssistant, upsertToolSegment, setStreaming, source]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      void loadHistoryOnce();
      lastUserTextRef.current = trimmed;
      apiMessagesRef.current = [...apiMessagesRef.current, { role: "user", content: trimmed }];
      setLiveEntries((prev) => [...prev, { id: nextId("user"), kind: "user", text: trimmed }]);
      void runAssistantTurn();
    },
    [loadHistoryOnce, runAssistantTurn, sending],
  );

  const retry = useCallback(() => {
    if (!lastUserTextRef.current || sending) return;
    const failedId = lastAssistantIdRef.current;
    setLiveEntries((prev) => {
      const next = prev.slice();
      // Drop the failed turn's error row(s)...
      while (next.length && next[next.length - 1].kind === "error") next.pop();
      // ...and the partial assistant bubble (text/tool rows) that turn
      // streamed before it failed, so the retry's fresh response replaces it
      // cleanly instead of appending after stale content. The user's message
      // stays untouched.
      if (failedId && next.length) {
        const last = next[next.length - 1];
        if (last.kind === "assistant" && last.id === failedId) next.pop();
      }
      return next;
    });
    void runAssistantTurn();
  }, [runAssistantTurn, sending]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const messages = historyEntries.concat(liveEntries);

  return {
    messages,
    historyLoading,
    historyError,
    sending,
    sendMessage,
    retry,
    retryHistory: loadHistoryOnce,
    stop,
  };
}

export type UseAssistantChatResult = ReturnType<typeof useAssistantChat>;

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

type ChatThreadProps = {
  messages: ChatEntry[];
  historyLoading: boolean;
  historyError: string | null;
  onRetryHistory: () => void;
  onRetry: () => void;
};

/**
 * The chat mode's message list (brief B6) — history rows (loaded once,
 * plain text bubbles) followed by the live turn-by-turn exchange. Owns its
 * own `ScrollView` (separate from the brief view's) so it can
 * auto-scroll-to-bottom as streamed text/tool rows arrive; the ask bar is
 * pinned outside this component by `AssistantSheet`.
 */
export function ChatThread({ messages, historyLoading, historyError, onRetryHistory, onRetry }: ChatThreadProps) {
  const { c } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      {historyLoading ? (
        <View style={styles.historySkeleton}>
          <Skeleton width="55%" height={11} />
          <Skeleton width="82%" height={11} />
          <Skeleton width="40%" height={11} />
        </View>
      ) : null}

      {historyError ? (
        <View style={styles.errorRow}>
          <Text style={[styles.errorText, { color: c.red }]}>{historyError.toUpperCase()}</Text>
          <Pressed onPress={onRetryHistory} hitSlop={8}>
            <Text style={[styles.retryLink, { color: c.accent }]}>RETRY</Text>
          </Pressed>
        </View>
      ) : null}

      {messages.length === 0 && !historyLoading ? (
        <Text style={[styles.empty, { color: c.ink38 }]}>Ask anything — I have the full picture.</Text>
      ) : null}

      {messages.map((entry) => (
        <ChatEntryRow key={entry.id} entry={entry} onRetry={onRetry} />
      ))}
    </ScrollView>
  );
}

function ChatEntryRow({ entry, onRetry }: { entry: ChatEntry; onRetry: () => void }) {
  const { c } = useTheme();

  if (entry.kind === "user") {
    return (
      <View style={styles.userRow}>
        <Text style={[styles.userText, { color: c.ink }]}>{entry.text}</Text>
      </View>
    );
  }

  if (entry.kind === "error") {
    return (
      <View style={styles.errorRow}>
        <Text style={[styles.errorText, { color: c.red }]}>{entry.message.toUpperCase()}</Text>
        <Pressed onPress={onRetry} hitSlop={8}>
          <Text style={[styles.retryLink, { color: c.accent }]}>RETRY</Text>
        </Pressed>
      </View>
    );
  }

  const hasContent = entry.segments.length > 0;
  return (
    <View style={styles.assistantRow}>
      <View style={[styles.assistantRail, { backgroundColor: c.bandBorder }]} />
      <View style={styles.assistantBody}>
        {entry.segments.map((seg) =>
          seg.kind === "text" ? (
            <Text key={seg.id} style={[styles.assistantText, { color: c.ink72 }]}>
              {seg.text}
            </Text>
          ) : (
            <View key={seg.id}>
              <Text style={[styles.toolLabel, { color: seg.status === "error" ? c.red : c.ink50 }]}>
                {(seg.status === "done" ? "✓ " : seg.status === "error" ? "✕ " : "· ") + toolLabel(seg.name)}
              </Text>
              {seg.status === "error" && seg.errorText ? (
                <Text style={[styles.toolError, { color: c.red }]}>{seg.errorText}</Text>
              ) : null}
            </View>
          ),
        )}
        {!hasContent && entry.streaming ? <Text style={[styles.assistantText, { color: c.ink38 }]}>···</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: 6,
    paddingBottom: 24,
  },
  historySkeleton: {
    gap: 8,
    marginBottom: 4,
  },
  empty: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 20,
  },
  userRow: {
    alignItems: "flex-end",
    marginTop: 18,
  },
  userText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
    maxWidth: "85%",
  },
  assistantRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  assistantRail: {
    width: 2,
    borderRadius: 1,
    alignSelf: "stretch",
  },
  assistantBody: {
    flex: 1,
    gap: 5,
  },
  assistantText: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    lineHeight: 20,
  },
  toolLabel: {
    fontFamily: fonts.mono500,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  toolError: {
    fontFamily: fonts.mono500,
    fontSize: 8.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  errorText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  retryLink: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
